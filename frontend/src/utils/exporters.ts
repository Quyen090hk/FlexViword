import type { TranscriptMeta, TranscriptSegment } from '@/types/domain'
import { formatDuration, formatTimecode } from './time'

export type ExportFormat = 'srt' | 'vtt' | 'txt' | 'md'

/**
 * 各格式的时间戳策略：
 * - required：字幕规范必需时间戳（SRT/VTT），导出 UI 中选项锁定
 * - optional：用户可切换（TXT 默认关、Markdown 默认开）
 */
export const FORMAT_TIMESTAMP_POLICY: Record<ExportFormat, 'required' | 'optional'> = {
  srt: 'required',
  vtt: 'required',
  txt: 'optional',
  md: 'optional',
}

/** 各格式的时间戳默认值（仅 optional 格式可被用户覆盖） */
export const FORMAT_DEFAULT_TIMESTAMPS: Record<ExportFormat, boolean> = {
  srt: true,
  vtt: true,
  txt: false,
  md: true,
}

export interface ExportOptions {
  /** 是否包含时间戳；required 格式忽略此选项，optional 格式未指定时用各格式默认值 */
  includeTimestamps?: boolean
}

/** WebVTT 需要 "WEBVTT" 头与毫秒点号分隔 */
export function buildVtt(segments: TranscriptSegment[]): string {
  const body = segments
    .map(
      (s, i) =>
        `${i + 1}\n${formatTimecode(s.start, '.')} --> ${formatTimecode(s.end, '.')}\n${s.text}`,
    )
    .join('\n\n')
  return `WEBVTT\n\n${body}\n`
}

export function buildSrt(segments: TranscriptSegment[]): string {
  const body = segments
    .map(
      (s, i) =>
        `${i + 1}\n${formatTimecode(s.start, ',')} --> ${formatTimecode(s.end, ',')}\n${s.text}`,
    )
    .join('\n\n')
  return `${body}\n`
}

export function buildPlainText(segments: TranscriptSegment[], includeTimestamps = false): string {
  const lines = segments.map((s) =>
    includeTimestamps
      ? `[${formatDuration(s.start)} → ${formatDuration(s.end)}] ${s.text}`
      : s.text,
  )
  return `${lines.join('\n')}\n`
}

export function buildMarkdown(
  name: string,
  meta: TranscriptMeta | undefined,
  segments: TranscriptSegment[],
  includeTimestamps = true,
): string {
  const lines: string[] = [`# ${name}`, '']
  if (meta) {
    lines.push(
      `> 引擎：${meta.engine} · 模型：${meta.model} · 导出时间：${new Date(
        meta.createdAt,
      ).toLocaleString()}`,
      '',
    )
  }
  if (includeTimestamps) {
    lines.push('| 时间 | 内容 |', '| --- | --- |')
    for (const s of segments) {
      lines.push(`| \`${formatTimecode(s.start).slice(0, 8)}\` | ${s.text} |`)
    }
  } else {
    for (const s of segments) {
      lines.push(`- ${s.text}`)
    }
  }
  return `${lines.join('\n')}\n`
}

export function buildExport(
  format: ExportFormat,
  name: string,
  meta: TranscriptMeta | undefined,
  segments: TranscriptSegment[],
  options: ExportOptions = {},
): { filename: string; content: string; mime: string } {
  // required 格式忽略覆盖；optional 格式未指定时用各格式默认值
  const includeTimestamps =
    FORMAT_TIMESTAMP_POLICY[format] === 'required'
      ? true
      : (options.includeTimestamps ?? FORMAT_DEFAULT_TIMESTAMPS[format])

  const base = name.replace(/\.[^.]+$/, '') || 'transcript'
  switch (format) {
    case 'srt':
      return { filename: `${base}.srt`, content: buildSrt(segments), mime: 'application/x-subrip' }
    case 'vtt':
      return { filename: `${base}.vtt`, content: buildVtt(segments), mime: 'text/vtt' }
    case 'md':
      return {
        filename: `${base}.md`,
        content: buildMarkdown(name, meta, segments, includeTimestamps),
        mime: 'text/markdown',
      }
    case 'txt':
    default:
      return {
        filename: `${base}.txt`,
        content: buildPlainText(segments, includeTimestamps),
        mime: 'text/plain',
      }
  }
}

/** 触发浏览器下载（Blob + a[download]） */
export function downloadText(filename: string, content: string, mime = 'text/plain'): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
