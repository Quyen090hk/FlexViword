import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import type { TaskRecord, TaskStage, TranscriptSegment } from '@/types/domain'
import { mediaKindOf } from '@/types/domain'
import { detectPlatform } from '@/services/bridge/platform'
import {
  clearAllTasks,
  deleteTask as repoDeleteTask,
  getAllTasks,
  getVideoFile,
  isPersistent,
  saveTask,
  saveVideoFile,
} from '@/services/db/task-repository'
import { resolveEngine } from '@/services/engines'
import { EngineError } from '@/services/engines/error'
import { t } from '@/i18n'
import { usePlayerStore } from './player'
import { useSettingsStore } from './settings'
import { useUiStore } from './ui'
import { uid } from '@/utils/id'

const TERMINAL_STAGES: TaskStage[] = ['completed', 'failed', 'canceled']

function isTerminal(stage: TaskStage): boolean {
  return TERMINAL_STAGES.includes(stage)
}

function describeError(err: unknown): string {
  if (err instanceof EngineError) {
    return t(`errors.${err.code}`, { message: err.message })
  }
  return err instanceof Error ? err.message : String(err)
}

/**
 * 任务编排中心：队列调度（同一时刻仅运行一个任务）→ 引擎执行 → 状态落库。
 * 组件层只与该 store 交互，不直接触碰引擎与 IndexedDB。
 */
export const useTasksStore = defineStore('tasks', () => {
  const settingsStore = useSettingsStore()
  const ui = useUiStore()
  const player = usePlayerStore()

  const tasks = ref<TaskRecord[]>([])
  const currentId = ref<string | null>(null)
  const runningId = ref<string | null>(null)
  const queue = ref<string[]>([])
  const persistent = ref(true)
  const initialized = ref(false)

  const controllers = new Map<string, AbortController>()
  const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()

  const currentTask = computed(
    () => tasks.value.find((task) => task.id === currentId.value) ?? null,
  )
  const sortedTasks = computed(() => [...tasks.value].sort((a, b) => b.createdAt - a.createdAt))
  const queuedCount = computed(() => queue.value.length)
  const hasActive = computed(() => runningId.value !== null)

  function byId(id: string): TaskRecord | undefined {
    return tasks.value.find((task) => task.id === id)
  }

  let initPromise: Promise<void> | null = null

  /**
   * 装载持久化的任务。共享 Promise：多处并发调用（main.ts 启动 + 视图挂载）
   * 等待同一次装载；再次调用不会重复拉取，也保证调用方能等到装载真正完成。
   */
  function init(): Promise<void> {
    initPromise ??= (async () => {
      initialized.value = true
      persistent.value = await isPersistent()
      const records = await getAllTasks()
      tasks.value = records.sort((a, b) => b.createdAt - a.createdAt)
      // 竞态保护：装载期间用户可能已选中任务（快速点击 / ?task= 恢复），只在未选择时兜底
      currentId.value ??= tasks.value[0]?.id ?? null
    })()
    return initPromise
  }

  /** 局部更新 + 阶段变化时落库（进行中的百分比进度只留在内存，避免高频写 IndexedDB） */
  function patch(id: string, partial: Partial<TaskRecord>): void {
    const task = byId(id)
    if (!task) return
    const stageChanged = partial.stage !== undefined && partial.stage !== task.stage
    Object.assign(task, partial, { updatedAt: Date.now() })
    if (stageChanged) void saveTask({ ...task })
  }

  async function addFromFile(file: File): Promise<string> {
    await init()
    const record: TaskRecord = {
      id: uid('task'),
      name: file.name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      stage: 'queued',
      progress: 0,
      video: {
        name: file.name,
        size: file.size,
        mime: file.type,
        kind: mediaKindOf(file.type, file.name),
      },
    }
    tasks.value.unshift(record)
    setCurrent(record.id)
    await saveVideoFile(record.id, file)
    await saveTask({ ...record })
    enqueue(record.id)
    return record.id
  }

  /** 批量导入：逐个建任务入队（单并发队列自动排队），返回成功数量 */
  async function addFromFiles(files: File[]): Promise<number> {
    let added = 0
    for (const file of files) {
      try {
        await addFromFile(file)
        added += 1
      } catch (err) {
        console.warn('[flexviword] batch add failed for', file.name, err)
      }
    }
    return added
  }

  /** 桌面模式：从本地路径创建任务（WebView 拿不到 File 对象，仅记录路径与元数据） */
  async function addFromPath(
    name: string,
    path: string,
    size: number,
    mime: string,
  ): Promise<string> {
    await init()
    const record: TaskRecord = {
      id: uid('task'),
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      stage: 'queued',
      progress: 0,
      video: { name, size, mime, path, kind: mediaKindOf(mime, name) },
    }
    tasks.value.unshift(record)
    setCurrent(record.id)
    await saveTask({ ...record })
    enqueue(record.id)
    return record.id
  }

  /** 桌面模式批量：文件夹导入的路径列表 */
  async function addFromPaths(
    entries: Array<{ name: string; path: string; size: number; mime: string }>,
  ): Promise<number> {
    let added = 0
    for (const entry of entries) {
      await addFromPath(entry.name, entry.path, entry.size, entry.mime)
      added += 1
    }
    return added
  }

  /** 无视频的演示任务：配合演示引擎，任何环境一键体验完整流程 */
  async function addDemoTask(): Promise<string> {
    await init()
    const record: TaskRecord = {
      id: uid('task'),
      name: 'FlexViword Demo.mp4',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      stage: 'queued',
      progress: 0,
      video: { name: 'FlexViword Demo.mp4', size: 0, mime: 'video/mp4', durationSec: 64 },
    }
    tasks.value.unshift(record)
    setCurrent(record.id)
    await saveTask({ ...record })
    enqueue(record.id)
    return record.id
  }

  function enqueue(id: string): void {
    const task = byId(id)
    if (!task) return
    if (runningId.value === id || queue.value.includes(id)) return
    patch(id, { stage: 'queued', progress: 0, error: undefined, message: undefined })
    queue.value.push(id)
    void pump()
  }

  const retry = enqueue

  function cancel(id: string): void {
    const controller = controllers.get(id)
    if (controller) {
      controller.abort()
      return
    }
    if (queue.value.includes(id)) {
      queue.value = queue.value.filter((queued) => queued !== id)
      patch(id, { stage: 'canceled' })
      const task = byId(id)
      if (task) void saveTask({ ...task })
    }
  }

  async function remove(id: string): Promise<void> {
    cancel(id)
    tasks.value = tasks.value.filter((task) => task.id !== id)
    editHistory.delete(id)
    if (currentId.value === id) {
      currentId.value = tasks.value[0]?.id ?? null
      if (currentId.value === null) player.reset()
    }
    await repoDeleteTask(id)
  }

  async function clearAll(): Promise<void> {
    for (const controller of controllers.values()) controller.abort()
    queue.value = []
    tasks.value = []
    editHistory.clear()
    currentId.value = null
    player.reset()
    await clearAllTasks()
  }

  function setCurrent(id: string | null): void {
    if (currentId.value === id) return
    currentId.value = id
    player.reset()
  }

  /** 播放器探测到真实时长后回填（后续引擎按真实时长估算时间轴） */
  function setVideoDuration(id: string, durationSec: number): void {
    const task = byId(id)
    if (!task || task.video.durationSec) return
    task.video = { ...task.video, durationSec }
    void saveTask({ ...task })
  }

  /**
   * 字幕编辑历史（命令栈模式）：每任务一个栈，保存变更前的整表快照。
   * 用 reactive Map 让 canUndo/canRedo 保持响应式；上限 50 步防内存膨胀。
   */
  const editHistory = reactive(
    new Map<string, { undo: TranscriptSegment[][]; redo: TranscriptSegment[][] }>(),
  )
  const HISTORY_CAP = 50

  function snapshot(segments: TranscriptSegment[]): TranscriptSegment[] {
    return segments.map((segment) => ({ ...segment }))
  }

  function pushHistory(taskId: string, segments: TranscriptSegment[]): void {
    let entry = editHistory.get(taskId)
    if (!entry) {
      entry = { undo: [], redo: [] }
      editHistory.set(taskId, entry)
    }
    entry.undo.push(snapshot(segments))
    if (entry.undo.length > HISTORY_CAP) entry.undo.shift()
    entry.redo.length = 0
  }

  function undoEdit(taskId: string): void {
    const task = byId(taskId)
    const entry = editHistory.get(taskId)
    const previous = entry?.undo.pop()
    if (!task?.segments || !previous || !entry) return
    entry.redo.push(snapshot(task.segments))
    task.segments = previous
    void saveTask({ ...task })
  }

  function redoEdit(taskId: string): void {
    const task = byId(taskId)
    const entry = editHistory.get(taskId)
    const next = entry?.redo.pop()
    if (!task?.segments || !next || !entry) return
    entry.undo.push(snapshot(task.segments))
    task.segments = next
    void saveTask({ ...task })
  }

  function updateSegment(taskId: string, segmentId: string, text: string): void {
    const task = byId(taskId)
    const segment = task?.segments?.find((seg) => seg.id === segmentId)
    if (!task || !segment || segment.text === text || !task.segments) return
    pushHistory(taskId, task.segments)
    segment.text = text
    segment.edited = true
    // 编辑动作高频触发：防抖 600ms 后统一落库（撤销栈即时入栈，不受防抖影响）
    const existing = saveTimers.get(taskId)
    if (existing) clearTimeout(existing)
    saveTimers.set(
      taskId,
      setTimeout(() => {
        saveTimers.delete(taskId)
        const record = byId(taskId)
        if (record) void saveTask({ ...record })
      }, 600),
    )
  }

  async function pump(): Promise<void> {
    if (runningId.value) return
    const nextId = queue.value.shift()
    if (!nextId) return
    const task = byId(nextId)
    if (!task || isTerminal(task.stage)) {
      void pump()
      return
    }
    runningId.value = nextId
    const controller = new AbortController()
    controllers.set(nextId, controller)

    const platform = detectPlatform()
    const { engine, fallbackReason } = resolveEngine(platform, settingsStore.settings)
    if (fallbackReason) ui.toast('info', t(fallbackReason))

    try {
      // 演示任务没有真实文件：是否需要文件由各引擎自行决定（mock 无需文件）
      let file: File | undefined
      if (platform === 'web') {
        file = await getVideoFile(nextId)
      }
      // 不预写阶段：各引擎自己上报起始阶段（whisper 会先报 downloading，预写会造成闪烁）
      const output = await engine.run(
        {
          task: { ...task },
          file,
          settings: settingsStore.settings,
          durationSec: task.video.durationSec,
        },
        {
          signal: controller.signal,
          // message 为 undefined 时不写入键：避免抹掉引擎早前上报的信息（如推理后端）
          report: (stage, progress, message) =>
            patch(
              nextId,
              message === undefined ? { stage, progress } : { stage, progress, message },
            ),
        },
      )
      patch(nextId, {
        stage: 'completed',
        progress: 100,
        segments: output.segments,
        meta: output.meta,
        error: undefined,
        message: undefined,
      })
      ui.toast('success', t('toast.taskCompleted'))
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        patch(nextId, { stage: 'canceled' })
      } else {
        const message = describeError(err)
        patch(nextId, { stage: 'failed', error: message })
        console.warn(`[flexviword] task ${nextId} failed:`, err)
        ui.toast('error', `${t('toast.taskFailed')} — ${message}`)
      }
    } finally {
      controllers.delete(nextId)
      runningId.value = null
      const record = byId(nextId)
      if (record) await saveTask({ ...record })
      void pump()
    }
  }

  return {
    tasks,
    currentId,
    currentTask,
    sortedTasks,
    runningId,
    queue,
    queuedCount,
    hasActive,
    persistent,
    initialized,
    init,
    addFromFile,
    addFromFiles,
    addFromPath,
    addFromPaths,
    addDemoTask,
    enqueue,
    retry,
    cancel,
    remove,
    clearAll,
    setCurrent,
    setVideoDuration,
    updateSegment,
    undoEdit,
    redoEdit,
    editHistory,
    byId,
  }
})
