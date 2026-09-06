import type { EngineContext, EngineInput, EngineOutput, TranscriptionEngine } from '@/types/domain'
import { decodeWavPcm16 } from '@/utils/wav'
import { uid } from '@/utils/id'
import { estimateSegments } from '@/utils/text'
import { extractAudioToWav } from '@/services/audio/ffmpeg-extractor'
import { getWailsApp, isDesktop } from '@/services/bridge/platform'
import type {
  WhisperTimestampedChunk,
  WhisperWorkerInbound,
  WhisperWorkerOutbound,
} from './whisper-protocol'
import { EngineError } from './error'
// Vite ?worker 导入：构建期把 worker 打成独立 chunk（见 vite.config.ts worker.format='es'）
import WhisperWorkerCtor from '../../workers/whisper.worker?worker'

/**
 * 本地 Whisper 引擎：权重下载一次后经浏览器缓存复用，推理在 Worker 内完成。
 * 流水线：加载模型（download 0-35）→ 本地提取音频并直读 16kHz PCM（extracting 35-70）
 * → Worker 内推理（transcribing 70-95）。Whisper return_timestamps 给出真实时间轴。
 */

type Listener = (message: WhisperWorkerOutbound) => void

class WhisperWorkerClient {
  private worker: Worker | null = null
  private listeners = new Set<Listener>()

  ensure(): Worker {
    if (!this.worker) {
      this.worker = new WhisperWorkerCtor()
      this.worker.addEventListener('message', (event: MessageEvent<WhisperWorkerOutbound>) => {
        for (const listener of this.listeners) listener(event.data)
      })
      this.worker.addEventListener('error', (event) => {
        for (const listener of this.listeners) {
          listener({ type: 'error', message: event.message || 'Whisper worker crashed' })
        }
      })
    }
    return this.worker
  }

  on(listener: Listener): void {
    this.listeners.add(listener)
  }

  off(listener: Listener): void {
    this.listeners.delete(listener)
  }

  send(message: WhisperWorkerInbound, transfer?: Transferable[]): void {
    this.ensure().postMessage(message, transfer ?? [])
  }

  /** 取消即杀掉 Worker：wasm 推理无法中断，终止后下次重建并重新加载缓存的模型 */
  terminate(): void {
    this.worker?.terminate()
    this.worker = null
    for (const listener of this.listeners) listener({ type: 'error', message: 'aborted' })
    this.listeners.clear()
  }
}

const client = new WhisperWorkerClient()

function request(
  message: WhisperWorkerInbound,
  ctx: EngineContext,
  isDone: (message: WhisperWorkerOutbound) => boolean,
  onEvent?: (message: WhisperWorkerOutbound) => void,
): Promise<WhisperWorkerOutbound> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      client.terminate()
      reject(new DOMException('The operation was aborted.', 'AbortError'))
    }
    if (ctx.signal.aborted) {
      onAbort()
      return
    }

    const listener: Listener = (message) => {
      if (message.type === 'error') {
        client.off(listener)
        ctx.signal.removeEventListener('abort', onAbort)
        if (message.message === 'aborted') {
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        } else {
          reject(new EngineError('LOCAL_MODEL', message.message))
        }
        return
      }
      if (isDone(message)) {
        client.off(listener)
        ctx.signal.removeEventListener('abort', onAbort)
        resolve(message)
        return
      }
      onEvent?.(message)
    }

    ctx.signal.addEventListener('abort', onAbort, { once: true })
    client.on(listener)
    client.send(message)
  })
}

/** 把 Worker 返回的带时间戳分块映射为字幕段；末段 end 为 null 时用音频时长兜底 */
export function chunksToSegments(
  chunks: WhisperTimestampedChunk[],
  durationSec: number,
): { segments: EngineOutput['segments']; estimated: boolean } {
  const usable = chunks.filter((chunk) => chunk.text.trim().length > 0)
  if (usable.length === 0) return { segments: [], estimated: true }

  const segments = usable.map((chunk, index) => {
    const prev = usable[index - 1]
    const start = Number.isFinite(chunk.start) ? chunk.start : (prev?.end ?? 0)
    // 末段 end 常为 null：有真实时长用时长，否则用 start+2 兜底，避免产出倒挂区间
    const fallbackEnd = durationSec > 0 ? durationSec : start + 2
    const end = chunk.end ?? fallbackEnd
    return { id: uid('seg'), start: Math.min(start, end), end, text: chunk.text.trim() }
  })
  return { segments, estimated: false }
}

async function resolveAudioSamples(input: EngineInput, ctx: EngineContext): Promise<Float32Array> {
  let blob: Blob

  if (isDesktop()) {
    // 桌面壳：Go 提取音频 → 本地流服务取回（流服务对任意本地文件都有效）
    const app = getWailsApp()
    const videoPath = input.task.video.path
    if (!videoPath) throw new EngineError('NO_FILE')
    const audioPath = await app.ConvertToAudio(videoPath).catch(() => {
      throw new EngineError('EXTRACT_FAILED')
    })
    ctx.report('extracting', 60)
    const url = await app.GetVideoStreamURL(audioPath)
    blob = await fetch(url).then((response) => {
      if (!response.ok) throw new EngineError('EXTRACT_FAILED', `HTTP ${response.status}`)
      return response.blob()
    })
  } else {
    if (!input.file) throw new EngineError('NO_FILE')
    blob = await extractAudioToWav(input.file, {
      signal: ctx.signal,
      onProgress: (ratio) => ctx.report('extracting', 35 + ratio * 30),
    }).catch((err) => {
      if (err instanceof DOMException && err.name === 'AbortError') throw err
      // 把底层原因带进 EngineError：UI 与任务记录都能看到真实失败原因
      throw new EngineError('EXTRACT_FAILED', err instanceof Error ? err.message : String(err), {
        cause: err,
      })
    })
  }

  ctx.report('extracting', 68)
  const buffer = await blob.arrayBuffer()
  const decoded = decodeWavPcm16(buffer)
  if (decoded.sampleRate !== 16000) {
    throw new EngineError('AUDIO_DECODE', `expected 16kHz, got ${decoded.sampleRate}Hz`)
  }
  return decoded.samples
}

export const whisperLocalEngine: TranscriptionEngine = {
  id: 'whisper-local',
  isReady: () => true,
  async run(input: EngineInput, ctx: EngineContext): Promise<EngineOutput> {
    // 文件检查前置：避免演示任务/缺失文件时白白触发模型下载
    if (!isDesktop() && !input.file) throw new EngineError('NO_FILE')
    if (isDesktop() && !input.task.video.path) throw new EngineError('NO_FILE')
    const duration = input.durationSec ?? 0

    // ---- 阶段一：加载/下载模型（0% ~ 35%，命中缓存时瞬间完成） ----
    ctx.report('downloading', 2)
    const ready = await request(
      { type: 'load', model: input.settings.localModel, device: 'auto' },
      ctx,
      (message) => message.type === 'status' && message.phase === 'ready',
      (message) => {
        if (message.type === 'download')
          ctx.report('downloading', 2 + (message.progress / 100) * 33)
      },
    )
    // 回显实际使用的推理后端（auto：WebGPU 优先，回退 WASM）
    const backend = ready.type === 'status' && ready.phase === 'ready' ? ready.device : 'wasm'
    ctx.report('downloading', 35, backend)

    // ---- 阶段二：提取音频 + 解码 PCM（35% ~ 70%） ----
    ctx.report('extracting', 35)
    const samples = await resolveAudioSamples(input, ctx)
    ctx.report('extracting', 70)

    // ---- 阶段三：Worker 内推理（70% ~ 95%） ----
    ctx.report('transcribing', 70)
    const result = await request(
      { type: 'transcribe', audio: samples, language: input.settings.localLanguage },
      ctx,
      (message) => message.type === 'result',
      (message) => {
        if (message.type === 'chunk' && duration > 0) {
          const estimated = Math.max(1, Math.ceil(duration / 30))
          ctx.report('transcribing', 70 + Math.min(0.9, message.completed / estimated) * 25)
        }
      },
    )

    if (result.type !== 'result') throw new EngineError('LOCAL_MODEL', 'unexpected worker reply')
    const { segments, estimated } = chunksToSegments(result.chunks, duration)

    if (segments.length === 0 && result.text.trim().length === 0) {
      throw new EngineError('EMPTY_RESULT')
    }

    const finalSegments =
      segments.length > 0
        ? segments
        : estimateSegments(result.text, duration > 0 ? duration : undefined)

    return {
      segments: finalSegments,
      meta: {
        engine: 'whisper-local',
        model: input.settings.localModel,
        durationSec: duration > 0 ? duration : undefined,
        createdAt: Date.now(),
        timingEstimated: estimated,
      },
    }
  },
}
