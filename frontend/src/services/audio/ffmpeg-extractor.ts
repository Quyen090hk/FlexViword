import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import { linkSignal } from '@/utils/abort'
// 显式提供 ffmpeg 类 Worker 地址：包内默认的 new URL('./worker.js', import.meta.url)
// 在 Vite dev（预打包依赖）下会 404 导致 load() 永久挂起
import ffmpegClassWorkerUrl from '@ffmpeg/ffmpeg/worker?worker&url'

/**
 * 浏览器端音频提取：ffmpeg.wasm（单线程核心，无需 SharedArrayBuffer/COEP 头）。
 * 输出 16kHz 单声道 WAV —— 语音识别的标准输入，也把上传体积压到最低。
 * 核心 wasm 约 32MB：带 CDN 回退（unpkg → jsdelivr）、下载进度上报与加载超时，
 * 弱网环境下不会无声卡死。
 */

// 注意：必须用 /esm/ 核心 —— @ffmpeg/ffmpeg 0.12 的类 Worker 是 module worker，
// importScripts(umd) 必然失败，回退的 import(umd) 又没有 default 导出（ERROR_IMPORT_FAILURE）
const CORE_SOURCES = [
  'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm',
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm',
]
const LOAD_TIMEOUT_MS = 180_000

let ffmpegSingleton: FFmpeg | null = null
let loadPromise: Promise<FFmpeg> | null = null

export function isFFmpegLoaded(): boolean {
  return ffmpegSingleton !== null
}

/**
 * 流式下载并转 Blob URL。
 * 不用 @ffmpeg/util 的 toBlobURL：它在压缩传输（gzip/br）下用 content-length
 * （压缩后大小）对账解压后字节数，必然误判“下载不完整”，且其回退路径会对已
 * 消费的流再次 arrayBuffer() 直接抛错 —— 这正是首次加载必挂的根因。
 */
async function fetchAsBlobURL(
  url: string,
  mime: string,
  onRatio?: (ratio: number) => void,
): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  const declared = Number(response.headers.get('content-length') ?? 0)
  const reader = response.body?.getReader()
  if (!reader) {
    const buffer = await response.arrayBuffer()
    onRatio?.(1)
    return URL.createObjectURL(new Blob([buffer], { type: mime }))
  }
  const chunks: Uint8Array[] = []
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      received += value.byteLength
      onRatio?.(declared > 0 ? Math.min(1, received / declared) : 0)
    }
  }
  const data = new Uint8Array(received)
  let position = 0
  for (const chunk of chunks) {
    data.set(chunk, position)
    position += chunk.byteLength
  }
  onRatio?.(1)
  return URL.createObjectURL(new Blob([data], { type: mime }))
}

async function loadFFmpeg(onLoadProgress?: (ratio: number) => void): Promise<FFmpeg> {
  if (ffmpegSingleton) return ffmpegSingleton
  loadPromise ??= (async () => {
    let lastError: unknown = new Error('no CDN attempted')
    for (const base of CORE_SOURCES) {
      const ff = new FFmpeg()
      try {
        const withTimeout = <T>(promise: Promise<T>): Promise<T> =>
          new Promise<T>((resolve, reject) => {
            const timer = setTimeout(
              () => reject(new Error(`ffmpeg core load timeout (${LOAD_TIMEOUT_MS / 1000}s)`)),
              LOAD_TIMEOUT_MS,
            )
            promise.then(
              (value) => {
                clearTimeout(timer)
                resolve(value)
              },
              (err) => {
                clearTimeout(timer)
                reject(err)
              },
            )
          })

        const download = async (file: string, mime: string, weight: number, offset: number) =>
          fetchAsBlobURL(`${base}/${file}`, mime, (ratio) => {
            onLoadProgress?.(offset * weight + ratio * weight)
          })

        // core.js 很小；core.wasm 约 32MB，占加载进度的绝大部分
        await withTimeout(
          ff.load({
            classWorkerURL: ffmpegClassWorkerUrl,
            coreURL: await download('ffmpeg-core.js', 'text/javascript', 0.05, 0),
            wasmURL: await download('ffmpeg-core.wasm', 'application/wasm', 0.95, 0.05),
          }),
        )
        ffmpegSingleton = ff
        return ff
      } catch (err) {
        lastError = err
        // 丢弃失败的实例，尝试下一个 CDN
        try {
          ff.terminate()
        } catch {
          /* 未加载完成时 terminate 可能抛错，忽略 */
        }
      }
    }
    loadPromise = null
    throw lastError
  })()
  try {
    return await loadPromise
  } catch (err) {
    // 加载失败（离线/CDN 不可达）时清空缓存，下次重试
    loadPromise = null
    throw err
  }
}

export interface ExtractOptions {
  signal?: AbortSignal
  /** 0-1：前 55% 为核心下载（首次），后 45% 为 ffmpeg 执行 */
  onProgress?: (ratio: number) => void
}

/**
 * 从视频容器中提取音频轨。
 * 命令行等价于：ffmpeg -i input.mp4 -vn -ac 1 -ar 16000 -c:a pcm_s16le output.wav
 */
export async function extractAudioToWav(file: Blob, opts: ExtractOptions = {}): Promise<Blob> {
  const { controller, dispose } = linkSignal(opts.signal)
  const ff = await loadFFmpeg((ratio) => opts.onProgress?.(ratio * 0.55))
  const onAbort = () => {
    // terminate 会杀掉 wasm 执行，单例作废，需要重新加载
    ff.terminate()
    ffmpegSingleton = null
    loadPromise = null
  }
  controller.signal.addEventListener('abort', onAbort, { once: true })

  const progressHandler = ({ progress }: { progress: number }) => {
    opts.onProgress?.(0.55 + Math.min(1, Math.max(0, progress)) * 0.45)
  }
  ff.on('progress', progressHandler)

  try {
    await ff.writeFile('input.media', await fetchFile(file))
    await ff.exec([
      '-i',
      'input.media',
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-c:a',
      'pcm_s16le',
      'output.wav',
    ])
    if (controller.signal.aborted) throw new DOMException('aborted', 'AbortError')
    const data = await ff.readFile('output.wav')
    return new Blob([data as BlobPart], { type: 'audio/wav' })
  } finally {
    ff.off('progress', progressHandler)
    controller.signal.removeEventListener('abort', onAbort)
    dispose()
    await safeCleanup(ff)
  }
}

async function safeCleanup(ff: FFmpeg): Promise<void> {
  try {
    await ff.deleteFile('input.media')
    await ff.deleteFile('output.wav')
  } catch {
    /* 文件可能不存在（被 terminate 清空），忽略 */
  }
}
