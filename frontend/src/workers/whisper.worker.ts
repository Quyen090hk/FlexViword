/// <reference lib="webworker" />
import type {
  WhisperTimestampedChunk,
  WhisperWorkerInbound,
  WhisperWorkerOutbound,
} from '@/services/engines/whisper-protocol'

/**
 * 本地 Whisper 推理 Worker（Transformers.js v3 + ONNX Runtime）。
 * - 模型 pipeline 在 Worker 内常驻：同一模型多次转写免重复加载；
 * - 计算后端 auto：优先 WebGPU，失败自动回退 WASM（CPU）；
 * - 模型源 auto：hf.co 主源失败自动切 hf-mirror 镜像；
 * - progress_callback 聚合各权重文件的下载进度；
 * - callback_function（token 级）+ chunk_callback（30s 分块级）双路进度上报。
 */

type WorkerScope = {
  postMessage: (message: WhisperWorkerOutbound) => void
  addEventListener: (
    type: 'message',
    listener: (event: MessageEvent<WhisperWorkerInbound>) => void,
  ) => void
}

const ctx = self as unknown as WorkerScope

function post(message: WhisperWorkerOutbound): void {
  ctx.postMessage(message)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AsrPipeline = any

let transcriber: AsrPipeline | null = null
let loadedModel: string | null = null
/** 上次成功的模型源：主源(hf.co)不可达时自动改用国内镜像并记住 */
let remoteHost: string | null = null
/** 上次成功的推理后端（用于状态回显） */
let activeDevice = 'wasm'

const fileProgress = new Map<string, number>()

function onDownloadProgress(event: { status: string; file?: string; progress?: number }): void {
  if (event.status === 'progress' && event.file) {
    fileProgress.set(event.file, event.progress ?? 0)
    const values = [...fileProgress.values()]
    const overall = values.reduce((sum, v) => sum + v, 0) / values.length
    post({ type: 'download', progress: Math.min(100, Math.round(overall)), file: event.file })
  }
}

function hasWebGPU(): boolean {
  return (
    typeof (self as unknown as { navigator?: { gpu?: unknown } }).navigator?.gpu !== 'undefined'
  )
}

/** 组装候选清单：WebGPU 可用时排在 WASM 前面（q8 量化两端通用） */
function deviceCandidates(prefer: 'auto' | 'wasm' | 'webgpu'): Array<'wasm' | 'webgpu'> {
  if (prefer === 'wasm') return ['wasm']
  const webgpuFirst: Array<'wasm' | 'webgpu'> =
    prefer === 'webgpu' ? ['webgpu', 'wasm'] : hasWebGPU() ? ['webgpu', 'wasm'] : ['wasm']
  return webgpuFirst
}

async function loadPipeline(model: string, device: 'auto' | 'wasm' | 'webgpu'): Promise<void> {
  if (transcriber && loadedModel === model) return
  post({ type: 'status', phase: 'loading' })
  const { pipeline, env } = await import('@huggingface/transformers')
  // 默认不找本地 /models 目录；权重从远端获取并经浏览器缓存复用
  env.allowLocalModels = false

  const hosts: string[] =
    remoteHost === 'https://hf-mirror.com'
      ? ['https://hf-mirror.com', 'https://huggingface.co']
      : [remoteHost ?? 'https://huggingface.co', 'https://hf-mirror.com']

  let lastError: unknown = new Error('no attempt made')
  for (const host of hosts) {
    env.remoteHost = host
    for (const candidate of deviceCandidates(device)) {
      try {
        fileProgress.clear()
        // WebGPU 上 q8 全量化会产出乱码（实测）；官方 WebGPU demo 的可靠配方是
        // fp32 编码器 + q4 解码器。WASM 用 q8。
        const dtype: 'q8' | { encoder_model: 'fp32'; decoder_model_merged: 'q4' } =
          candidate === 'webgpu' ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8'
        transcriber = await pipeline('automatic-speech-recognition', model, {
          dtype,
          device: candidate,
          progress_callback: onDownloadProgress,
        })
        remoteHost = host
        activeDevice = candidate
        loadedModel = model
        return
      } catch (err) {
        lastError = err
        transcriber = null
      }
    }
  }
  throw lastError
}

async function transcribe(audio: Float32Array, language: 'auto' | 'zh' | 'en'): Promise<void> {
  if (!transcriber) throw new Error('Whisper pipeline is not loaded')

  let tokenCount = 0
  let lastReported = 0
  let chunkCompleted = 0

  const options = {
    task: 'transcribe',
    return_timestamps: true,
    chunk_length_s: 30,
    stride_length_s: 5,
    ...(language !== 'auto' ? { language } : {}),
    callback_function: () => {
      tokenCount += 1
      if (tokenCount - lastReported >= 40) {
        lastReported = tokenCount
        post({ type: 'tokens', count: tokenCount })
      }
    },
    chunk_callback: () => {
      chunkCompleted += 1
      post({ type: 'chunk', completed: chunkCompleted })
    },
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const output: any = await transcriber(audio, options)

  const chunks: WhisperTimestampedChunk[] = (
    (output.chunks ?? []) as Array<{ timestamp: [number | null, number | null]; text: string }>
  ).map((chunk) => ({
    start: chunk.timestamp?.[0] ?? 0,
    end: chunk.timestamp?.[1] ?? null,
    text: chunk.text ?? '',
  }))

  post({ type: 'result', text: output.text ?? '', chunks })
}

ctx.addEventListener('message', (event) => {
  const message = event.data
  void (async () => {
    try {
      if (message.type === 'load') {
        await loadPipeline(message.model, message.device)
        post({ type: 'status', phase: 'ready', model: message.model, device: activeDevice })
      } else if (message.type === 'transcribe') {
        await transcribe(message.audio, message.language)
      }
    } catch (err) {
      post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  })()
})
