/**
 * 时间格式化工具。
 * 转写领域里有两类时间：播放器显示的 mm:ss / h:mm:ss，
 * 以及字幕文件（SRT/VTT）要求的 HH:MM:SS,mmm 时间码。
 */

function pad(n: number, width = 2): string {
  return String(Math.floor(n)).padStart(width, '0')
}

/** 92 -> "1:32"，3700 -> "1:01:40" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

/** 92.5 -> "00:01:32,500"（sep 为毫秒分隔符，SRT 用逗号，VTT 用点） */
export function formatTimecode(totalSeconds: number, sep: ',' | '.' = ','): string {
  const ms = Math.max(0, Math.round(totalSeconds * 1000))
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  const seconds = Math.floor((ms % 60_000) / 1000)
  const millis = ms % 1000
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}${sep}${pad(millis, 3)}`
}

/** "00:01:32,500" | "01:32.500" | "92.5" -> 秒；非法输入返回 null */
export function parseTimecode(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const parts = trimmed.replace(',', '.').split(':')
  if (parts.length > 3) return null
  let seconds = 0
  for (const part of parts) {
    const n = Number(part)
    if (!Number.isFinite(n) || n < 0) return null
    seconds = seconds * 60 + n
  }
  return seconds
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** 字节的人类可读表示 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`
}
