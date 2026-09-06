import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTasksStore } from '../tasks'
import { getAllTasks, saveTask } from '@/services/db/task-repository'
import { idbGetAll, STORE_TASKS } from '@/services/db/idb'
import type { TaskRecord } from '@/types/domain'

function makeRecord(id: string): TaskRecord {
  return {
    id,
    name: `${id}.mp4`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    stage: 'completed',
    progress: 100,
    video: { name: `${id}.mp4`, size: 0, mime: 'video/mp4' },
  }
}

/**
 * 任务编排 store 的端到端测试：真实的 mock 引擎 + 真实的 IndexedDB（fake-indexeddb），
 * 仅用 fake timers 压缩模拟引擎的耗时。
 */
describe('tasks store pipeline', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // 只劫持 setTimeout/clearTimeout：fake-indexeddb 依赖 queueMicrotask 调度，劫持它会死锁
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function runDemo() {
    const store = useTasksStore()
    await store.init()
    const id = await store.addDemoTask()
    await vi.advanceTimersByTimeAsync(4000)
    return { store, id }
  }

  it('runs a demo task to completion with transcript segments', async () => {
    const { store, id } = await runDemo()
    const task = store.byId(id)
    expect(task?.stage).toBe('completed')
    expect(task?.progress).toBe(100)
    expect(task?.segments?.length).toBeGreaterThan(4)
    expect(task?.segments?.[0]?.start).toBe(0)
    expect(task?.meta?.engine).toBe('mock')
    expect(task?.video.durationSec).toBe(64)
  })

  it('cancels a running task', async () => {
    const store = useTasksStore()
    await store.init()
    const id = await store.addDemoTask()
    await vi.advanceTimersByTimeAsync(600)
    store.cancel(id)
    await vi.advanceTimersByTimeAsync(200)
    expect(store.byId(id)?.stage).toBe('canceled')
    expect(store.runningId).toBeNull()
  })

  it('persists task records into IndexedDB', async () => {
    const { id } = await runDemo()
    const records = await getAllTasks()
    const record = records.find((item) => item.id === id)
    expect(record?.stage).toBe('completed')
    expect(record?.segments?.length).toBeGreaterThan(0)
  })

  it('persists reactive records to raw IndexedDB without proxy cloning errors', async () => {
    // 回归测试：saveTask 若直接把 Vue 响应式 Proxy 交给 IDB，结构化克隆会抛
    // DataCloneError 且被降级逻辑吞掉 —— IDB 里的记录将永远停在 queued。
    // 这里绕过仓库的内存兜底，直读 IndexedDB 验证真实落库内容。
    const { store, id } = await runDemo()
    const rawRecords = await idbGetAll<TaskRecord>(STORE_TASKS)
    const raw = rawRecords.find((item) => item.id === id)
    expect(raw?.stage).toBe('completed')
    expect(raw?.segments?.length).toBeGreaterThan(0)
    expect(store.persistent).toBe(true)
  })

  it('updates segment text and debounces persistence', async () => {
    const { store, id } = await runDemo()
    const segmentId = store.byId(id)?.segments?.[0]?.id
    expect(segmentId).toBeDefined()

    store.updateSegment(id, segmentId!, '编辑后的文本')
    expect(store.byId(id)?.segments?.[0]?.text).toBe('编辑后的文本')
    expect(store.byId(id)?.segments?.[0]?.edited).toBe(true)

    await vi.advanceTimersByTimeAsync(700)
    const records = await getAllTasks()
    const record = records.find((item) => item.id === id)
    expect(record?.segments?.[0]?.text).toBe('编辑后的文本')
  })

  it('removes a task from the store and the repository', async () => {
    const { store, id } = await runDemo()
    await store.remove(id)
    expect(store.byId(id)).toBeUndefined()
    const records = await getAllTasks()
    expect(records.find((item) => item.id === id)).toBeUndefined()
  })

  it('does not clobber a selection made while init is in flight', async () => {
    const store = useTasksStore()
    await saveTask(makeRecord('task_x'))
    // 模拟启动竞态：init 尚未完成时用户已选中任务（快速点击 / ?task= 恢复）
    const first = store.init()
    const second = store.init()
    store.setCurrent('task_x')
    await Promise.all([first, second])
    expect(store.currentId).toBe('task_x')
  })

  it('creates a task from a real File object (web path)', async () => {
    const store = useTasksStore()
    await store.init()
    const file = new File(['fake-video-bytes'], 'lecture.mp4', { type: 'video/mp4' })
    const id = await store.addFromFile(file)
    await vi.advanceTimersByTimeAsync(4000)
    const task = store.byId(id)
    expect(task?.name).toBe('lecture.mp4')
    expect(task?.stage).toBe('completed')
    expect(store.currentId).toBe(id)
  })

  it('undoes and redoes segment edits via the history stack', async () => {
    const { store, id } = await runDemo()
    const first = store.byId(id)!.segments![0]!
    const original = first.text

    store.updateSegment(id, first.id, '第一次编辑')
    store.updateSegment(id, first.id, '第二次编辑')
    expect(first.text).toBe('第二次编辑')
    expect(store.editHistory.get(id)?.undo).toHaveLength(2)
    expect(store.editHistory.get(id)?.redo).toHaveLength(0)

    // 撤销会整体替换 segments 数组（快照恢复），需从 store 重新读取
    store.undoEdit(id)
    expect(store.byId(id)!.segments![0]!.text).toBe('第一次编辑')
    expect(store.editHistory.get(id)?.redo).toHaveLength(1)

    store.undoEdit(id)
    expect(store.byId(id)!.segments![0]!.text).toBe(original)

    store.redoEdit(id)
    expect(store.byId(id)!.segments![0]!.text).toBe('第一次编辑')
    store.redoEdit(id)
    expect(store.byId(id)!.segments![0]!.text).toBe('第二次编辑')
    // 重做后撤销栈保留、重做栈清空
    expect(store.editHistory.get(id)?.undo).toHaveLength(2)
    expect(store.editHistory.get(id)?.redo).toHaveLength(0)
  })

  it('drops the redo branch when a new edit lands after undo', async () => {
    const { store, id } = await runDemo()
    const first = store.byId(id)!.segments![0]!
    store.updateSegment(id, first.id, 'A')
    store.undoEdit(id)
    expect(store.editHistory.get(id)?.redo).toHaveLength(1)
    store.updateSegment(id, first.id, 'B')
    expect(store.editHistory.get(id)?.redo).toHaveLength(0)
  })
})
