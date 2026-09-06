import type { EngineContext, EngineInput, EngineOutput, TranscriptionEngine } from '@/types/domain'
import { throwIfAborted } from '@/utils/abort'
import { estimateSegments } from '@/utils/text'
import { extractAudioToWav } from '@/services/audio/ffmpeg-extractor'
import { EngineError } from './error'

/**
 * SiliconFlow 语音识别引擎（浏览器路径）。
 * 流水线：ffmpeg.wasm 本地提取音频 → multipart/form-data 上传 → 文本按时长估算时间轴。
 *
 * CORS 说明：api.siliconflow.cn 未开放跨域，浏览器直连会被拦截。
 * 开发态由 Vite proxy（/api/siliconflow → api.siliconflow.cn）转发；
 * 生产态建议部署一个轻量 BFF —— 密钥始终保存在用户本地，不经过 BFF 存储。
 */

interface TranscriptionResponse {
  text?: string
  message?: string
}

export const siliconflowEngine: TranscriptionEngine = {
  id: 'siliconflow',
  isReady: (settings) => settings.apiKey.trim().length > 0,
  async run(input: EngineInput, ctx: EngineContext): Promise<EngineOutput> {
    const { settings } = input
    if (!settings.apiKey.trim()) throw new EngineError('NO_API_KEY')

    // ---- 阶段一：提取音频（0% ~ 40%） ----
    if (!input.file) throw new EngineError('NO_FILE')
    ctx.report('extracting', 5)
    let audio: Blob
    try {
      audio = await extractAudioToWav(input.file, {
        signal: ctx.signal,
        onProgress: (ratio) => ctx.report('extracting', 5 + ratio * 35),
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err
      throw new EngineError('EXTRACT_FAILED', err instanceof Error ? err.message : String(err), {
        cause: err,
      })
    }
    throwIfAborted(ctx.signal)

    // ---- 阶段二：上传并识别（40% ~ 95%） ----
    ctx.report('transcribing', 40)
    const form = new FormData()
    form.append('file', audio, 'audio.wav')
    form.append('model', settings.model)
    let response: Response
    try {
      response = await fetch(settings.baseUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${settings.apiKey.trim()}` },
        body: form,
        signal: ctx.signal,
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err
      throw new EngineError('REQUEST_FAILED', undefined, { cause: err })
    }
    ctx.report('transcribing', 70)

    if (!response.ok) {
      throw new EngineError('API_ERROR', `HTTP ${response.status}`, {
        cause: await safeJson(response),
      })
    }
    const payload = (await response.json()) as TranscriptionResponse
    const text = payload.text?.trim()
    if (!text) throw new EngineError('EMPTY_RESULT')
    ctx.report('transcribing', 95)

    const segments = estimateSegments(text, input.durationSec)
    return {
      segments,
      meta: {
        engine: 'siliconflow',
        model: settings.model,
        durationSec: input.durationSec,
        createdAt: Date.now(),
        timingEstimated: true,
      },
    }
  },
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return response.statusText
  }
}
