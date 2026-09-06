/**
 * 主线程 ↔ Whisper Worker 的消息协议。
 * Worker 内动态 import @huggingface/transformers，保证模型推理代码
 * 独立成 chunk，不进主包；权重由 HF CDN 下载并经浏览器缓存复用。
 */

export type WhisperModelId = string

/** 推理后端：auto = 优先 WebGPU（若可用），失败回退 WASM */
export type WhisperDevice = 'auto' | 'wasm' | 'webgpu'

export type WhisperWorkerInbound =
  | { type: 'load'; model: WhisperModelId; device: WhisperDevice }
  | {
      type: 'transcribe'
      /** 16kHz 单声道 [-1,1] 采样（transferable） */
      audio: Float32Array
      /** 'auto' 交给 Whisper 自动检测 */
      language: 'auto' | 'zh' | 'en'
    }

export interface WhisperTimestampedChunk {
  start: number
  /** 末段可能为 null：由主线程用音频时长兜底 */
  end: number | null
  text: string
}

export type WhisperWorkerOutbound =
  | { type: 'status'; phase: 'loading' }
  | { type: 'status'; phase: 'ready'; model: WhisperModelId; device: string }
  /** 模型文件下载聚合进度 0-100 */
  | { type: 'download'; progress: number; file: string }
  /** token 生成进度（节流后上报） */
  | { type: 'tokens'; count: number }
  /** 长音频分块完成回调 */
  | { type: 'chunk'; completed: number }
  | { type: 'result'; text: string; chunks: WhisperTimestampedChunk[] }
  | { type: 'error'; message: string }
