import type { TranscriptionSettings } from './settings'

/** 转写任务所处的阶段 */
export type TaskStage =
  | 'queued' // 排队等待（同一时间只运行一个任务）
  | 'downloading' // 本地模型权重下载（仅 whisper-local 首次）
  | 'extracting' // 提取音频
  | 'transcribing' // 调用识别引擎
  | 'completed'
  | 'failed'
  | 'canceled'

/**
 * 引擎标识：
 * mock=离线演示；siliconflow=浏览器直连/代理；wails=桌面壳内调用 Go；
 * whisper-local=本地 Whisper（浏览器内 WASM 推理，无需任何 API Key）
 */
export type EngineId = 'mock' | 'siliconflow' | 'wails' | 'whisper-local'

export type Platform = 'web' | 'wails'

/** 一条字幕片段（时间单位：秒） */
export interface TranscriptSegment {
  id: string
  start: number
  end: number
  text: string
  /** 是否被用户编辑过 */
  edited?: boolean
}

/** 识别结果元信息 */
export interface TranscriptMeta {
  engine: EngineId
  model: string
  /** 音视频总时长（秒）；mock 任务可能没有 */
  durationSec?: number
  createdAt: number
  /** 无时间戳文本按句切分并按时长均匀分布时标记为 estimated */
  timingEstimated?: boolean
}

/** 媒体类型：视频或纯音频（输入源扩展后录音/音频文件直接转写） */
export type MediaKind = 'video' | 'audio'

/** 任务中的媒体资产。浏览器模式持有 File，桌面模式持有本地路径 */
export interface VideoAsset {
  name: string
  size: number
  mime: string
  /** video | audio（按 mime 推断，录音与纯音频走同一转写管线） */
  kind?: MediaKind
  /** 浏览器模式：原始文件（运行期存在于内存/IDB） */
  file?: File
  /** 桌面模式：本地文件路径 */
  path?: string
  /** 媒体时长（秒），由播放器/引擎探测 */
  durationSec?: number
}

/** 按 mime 推断媒体种类；mime 缺失时按扩展名猜（webm 歧义默认按视频） */
export function mediaKindOf(mime: string, name: string): MediaKind {
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('video/')) return 'video'
  return /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac)$/i.test(name) ? 'audio' : 'video'
}

/** 持久化到 IndexedDB 的任务记录（不含运行期对象 URL） */
export interface TaskRecord {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  stage: TaskStage
  /** 0 - 100，跨阶段归一化进度 */
  progress: number
  /** 当前阶段的人类可读消息（i18n key 或原文） */
  message?: string
  error?: string
  video: Pick<VideoAsset, 'name' | 'size' | 'mime' | 'path' | 'kind'> & { durationSec?: number }
  segments?: TranscriptSegment[]
  meta?: TranscriptMeta
}

/** 引擎的运行上下文：用于上报进度与协作取消 */
export interface EngineContext {
  signal: AbortSignal
  report: (stage: TaskStage, progress: number, message?: string) => void
}

export interface EngineInput {
  task: TaskRecord
  /** 浏览器模式下可用的原始视频文件 */
  file?: File
  settings: TranscriptionSettings
  /** 视频时长（秒），用于生成/估算时间轴 */
  durationSec?: number
}

export interface EngineOutput {
  segments: TranscriptSegment[]
  meta: TranscriptMeta
}

/** 转写引擎统一接口 —— 教学点：依赖倒置，UI 只依赖该抽象 */
export interface TranscriptionEngine {
  id: EngineId
  /** 是否需要额外配置（如 API Key）才能运行 */
  isReady: (settings: TranscriptionSettings) => boolean
  run: (input: EngineInput, ctx: EngineContext) => Promise<EngineOutput>
}
