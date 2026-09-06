import { isDesktop, getWailsApp } from './platform'

export interface PickedMedia {
  name: string
  size: number
  mime: string
  file?: File
  path?: string
}

/** 视频 + 纯音频都接受（录音/播客/音乐直接转写） */
const MEDIA_ACCEPT = 'video/*,audio/*,.mp4,.mov,.mkv,.mp3,.wav,.m4a,.aac,.ogg,.opus,.flac'

function guessMime(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'mp4':
      return 'video/mp4'
    case 'mov':
      return 'video/quicktime'
    case 'mkv':
      return 'video/x-matroska'
    case 'mp3':
      return 'audio/mpeg'
    case 'wav':
      return 'audio/wav'
    case 'm4a':
      return 'audio/mp4'
    case 'aac':
      return 'audio/aac'
    case 'ogg':
    case 'oga':
    case 'opus':
      return 'audio/ogg'
    case 'flac':
      return 'audio/flac'
    default:
      return ''
  }
}

/**
 * 选择媒体文件（可多选）。
 * - 浏览器：动态创建 <input type="file" multiple>，监听 change/cancel
 * - 桌面壳：调用 Go 侧文件对话框（单选，只返回路径）
 */
export async function pickMediaFiles(multiple = false): Promise<PickedMedia[]> {
  if (isDesktop()) {
    const app = getWailsApp()
    const path = await app.SelectVideo()
    if (!path) return []
    const name = path.replace(/\\/g, '/').split('/').pop() ?? path
    return [{ name, size: 0, mime: guessMime(name), path }]
  }

  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = MEDIA_ACCEPT
    input.multiple = multiple
    let settled = false
    const finish = (value: PickedMedia[]) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    input.addEventListener('change', () => {
      finish(
        Array.from(input.files ?? []).map((file) => ({
          name: file.name,
          size: file.size,
          mime: file.type || guessMime(file.name),
          file,
        })),
      )
    })
    // 用户取消：现代浏览器支持 cancel 事件
    input.addEventListener('cancel', () => finish([]))
    input.click()
  })
}

/** 从拖拽 DataTransfer 中找出媒体文件（视频或音频） */
export function mediaFromDataTransfer(dt: DataTransfer): File | null {
  for (const file of Array.from(dt.files)) {
    const mime = file.type || guessMime(file.name)
    if (mime.startsWith('video/') || mime.startsWith('audio/')) return file
    if (/\.(mp4|mov|mkv|mp3|wav|m4a|aac|ogg|opus|flac)$/i.test(file.name)) return file
  }
  return null
}
