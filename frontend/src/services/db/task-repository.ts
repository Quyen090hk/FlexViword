import type { TaskRecord } from '@/types/domain'
import {
  idbAvailable,
  idbClear,
  idbDelete,
  idbGet,
  idbGetAll,
  idbPut,
  STORE_FILES,
  STORE_TASKS,
} from './idb'

/**
 * 任务仓库。
 * IndexedDB 不可用（隐私模式/配额拒绝）时自动降级为内存存储：
 * 功能不中断，只是刷新后数据不保留 —— UI 上会提示当前会话数据不持久化。
 */

const memoryTasks = new Map<string, TaskRecord>()
const memoryFiles = new Map<string, File>()

let persistent: boolean | null = null

export async function isPersistent(): Promise<boolean> {
  if (persistent === null) persistent = await idbAvailable()
  return persistent
}

export async function getAllTasks(): Promise<TaskRecord[]> {
  if (await isPersistent()) {
    try {
      return await idbGetAll<TaskRecord>(STORE_TASKS)
    } catch {
      persistent = false
    }
  }
  return [...memoryTasks.values()]
}

/**
 * 深转纯对象。关键：store 里传进来的记录是 Vue 响应式 Proxy（segments/video 是嵌套
 * 代理），indexedDB.put 对 Proxy 结构化克隆必然抛 DataCloneError —— 若不处理，
 * 创建之后的任何更新（阶段流转/字幕）都会被这里的 catch 静默吞掉，IDB 永远停在
 * 初次创建的 queued 状态。
 */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export async function saveTask(task: TaskRecord): Promise<void> {
  memoryTasks.set(task.id, task)
  if (await isPersistent()) {
    try {
      await idbPut(STORE_TASKS, plain(task))
      return
    } catch (err) {
      console.warn('[flexviword] task persist failed, falling back to memory:', err)
      persistent = false
    }
  }
}

export async function deleteTask(id: string): Promise<void> {
  memoryTasks.delete(id)
  memoryFiles.delete(id)
  if (await isPersistent()) {
    try {
      await idbDelete(STORE_TASKS, id)
      await idbDelete(STORE_FILES, id)
      return
    } catch {
      persistent = false
    }
  }
}

export async function clearAllTasks(): Promise<void> {
  memoryTasks.clear()
  memoryFiles.clear()
  if (await isPersistent()) {
    try {
      await idbClear(STORE_TASKS)
      await idbClear(STORE_FILES)
      return
    } catch {
      persistent = false
    }
  }
}

/** 视频原始文件与任务分开存：列表加载只读元数据，不拉大 Blob */
export async function saveVideoFile(taskId: string, file: File): Promise<void> {
  memoryFiles.set(taskId, file)
  if (await isPersistent()) {
    try {
      await idbPut(STORE_FILES, file, taskId)
      return
    } catch (err) {
      // 大文件超出配额是常态：保留内存引用即可，任务元数据仍可持久化
      console.warn('[flexviword] video file persist failed (memory only):', err)
    }
  }
}

export async function getVideoFile(taskId: string): Promise<File | undefined> {
  if (await isPersistent()) {
    try {
      const file = await idbGet<File>(STORE_FILES, taskId)
      if (file) {
        memoryFiles.set(taskId, file)
        return file
      }
    } catch {
      persistent = false
    }
  }
  return memoryFiles.get(taskId)
}
