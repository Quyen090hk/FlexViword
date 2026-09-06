import type { EngineContext, EngineInput, EngineOutput, TranscriptionEngine } from '@/types/domain'
import { abortError, throwIfAborted } from '@/utils/abort'
import { estimateSegments } from '@/utils/text'
import { getWailsApp, isDesktop } from '@/services/bridge/platform'
import { EngineError } from './error'

/**
 * 桌面壳引擎：提取音频与识别都交给 Go 侧（本地 FFmpeg + SiliconFlow 云端识别），无 CORS 限制。
 * wailsjs 绑定不做静态 import，运行时从 window.go 取，保证纯浏览器构建不携带桌面代码。
 *
 * 与其它引擎的兼容性约定：
 * - 设置透传一致：model 来自同一份设置（Go 侧按模型名调用 SiliconFlow）；
 * - 取消语义：Go 绑定不支持中断 → 用 Promise.race 让取消立即生效（队列不阻塞），
 *   已启动的 Go 调用在后台自然结束、结果丢弃；阶段边界再做一次 AbortSignal 检查。
 */
export const wailsEngine: TranscriptionEngine = {
  id: 'wails',
  isReady: (settings) => isDesktop() && settings.apiKey.trim().length > 0,
  async run(input: EngineInput, ctx: EngineContext): Promise<EngineOutput> {
    const app = getWailsApp()
    const videoPath = input.task.video.path
    if (!videoPath) throw new EngineError('NO_FILE')
    throwIfAborted(ctx.signal)

    ctx.report('extracting', 5)
    const audioPath = await raceAbort(app.ConvertToAudio(videoPath), ctx.signal).catch((err) => {
      throw wrapAbort(err, new EngineError('EXTRACT_FAILED', String(err), { cause: err }))
    })
    ctx.report('extracting', 40)
    throwIfAborted(ctx.signal)

    ctx.report('transcribing', 45)
    const text = await raceAbort(
      app.TranscribeAPI(input.settings.apiKey, input.settings.model, audioPath),
      ctx.signal,
    ).catch((err) => {
      throw wrapAbort(err, new EngineError('API_ERROR', String(err), { cause: err }))
    })
    ctx.report('transcribing', 95)
    throwIfAborted(ctx.signal)

    const trimmed = text?.trim()
    if (!trimmed) throw new EngineError('EMPTY_RESULT')
    return {
      segments: estimateSegments(trimmed, input.durationSec),
      meta: {
        engine: 'wails',
        model: input.settings.model,
        durationSec: input.durationSec,
        createdAt: Date.now(),
        timingEstimated: true,
      },
    }
  },
}

/** Go 调用与取消信号的赛跑：取消立即返回 AbortError，Go 调用在后台自然结束 */
function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError())
      return
    }
    const onAbort = () => reject(abortError())
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (err) => {
        signal.removeEventListener('abort', onAbort)
        reject(err)
      },
    )
  })
}

/** 已中止的信号优先归一为取消异常，否则包成引擎错误 */
function wrapAbort(err: unknown, fallback: EngineError): unknown {
  if (err instanceof DOMException && err.name === 'AbortError') return err
  if (err instanceof EngineError) return err
  return fallback
}
