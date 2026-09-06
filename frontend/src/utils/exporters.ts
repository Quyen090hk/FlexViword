import type { TranscriptMeta, TranscriptSegment } from '@/types/domain'
import { formatTimecode } from './time'

export type ExportFormat = 'srt' | 'vtt' | 'txt' | 'md'

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

export function buildPlainText(segments: TranscriptSegment[]): string {
  return `${segments.map((s) => s.text).join('\n')}\n`
}

export function buildMarkdown(
  name: string,
  meta: TranscriptMeta | undefined,
  segments: TranscriptSegment[],
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
  lines.push('| 时间 | 内容 |', '| --- | --- |')
  for (const s of segments) {
    lines.push(`| \`${formatTimecode(s.start).slice(0, 8)}\` | ${s.text} |`)
  }
  return `${lines.join('\n')}\n`
}

export function buildExport(
  format: ExportFormat,
  name: string,
  meta: TranscriptMeta | undefined,
  segments: TranscriptSegment[],
): { filename: string; content: string; mime: string } {
  const base = name.replace(/\.[^.]+$/, '') || 'transcript'
  switch (format) {
    case 'srt':
      return { filename: `${base}.srt`, content: buildSrt(segments), mime: 'application/x-subrip' }
    case 'vtt':
      return { filename: `${base}.vtt`, content: buildVtt(segments), mime: 'text/vtt' }
    case 'md':
      return {
        filename: `${base}.md`,
        content: buildMarkdown(name, meta, segments),
        mime: 'text/markdown',
      }
    case 'txt':
    default:
      return { filename: `${base}.txt`, content: buildPlainText(segments), mime: 'text/plain' }
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
