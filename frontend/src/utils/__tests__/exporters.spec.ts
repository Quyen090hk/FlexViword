import { describe, expect, it } from 'vitest'
import { buildExport, buildPlainText, buildSrt, buildVtt, downloadText } from '../exporters'
import type { TranscriptMeta, TranscriptSegment } from '@/types/domain'

const segments: TranscriptSegment[] = [
  { id: 'a', start: 0, end: 2.5, text: '第一句' },
  { id: 'b', start: 2.5, end: 5, text: '第二句' },
]

const meta: TranscriptMeta = {
  engine: 'mock',
  model: 'demo',
  durationSec: 5,
  createdAt: 0,
}

describe('buildSrt', () => {
  it('numbers blocks and uses comma timecodes', () => {
    const srt = buildSrt(segments)
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:02,500\n第一句')
    expect(srt).toContain('2\n00:00:02,500 --> 00:00:05,000\n第二句')
  })
})

describe('buildVtt', () => {
  it('starts with WEBVTT header and uses dot timecodes', () => {
    const vtt = buildVtt(segments)
    expect(vtt.startsWith('WEBVTT\n\n')).toBe(true)
    expect(vtt).toContain('00:00:00.000 --> 00:00:02.500')
  })
})

describe('buildPlainText', () => {
  it('joins segment texts line by line', () => {
    expect(buildPlainText(segments)).toBe('第一句\n第二句\n')
  })
})

describe('buildExport', () => {
  it('derives filename from task name', () => {
    const result = buildExport('srt', 'lecture.mp4', meta, segments)
    expect(result.filename).toBe('lecture.srt')
    expect(result.mime).toBe('application/x-subrip')
  })

  it('falls back to txt', () => {
    const result = buildExport('txt', 'lecture.mp4', meta, segments)
    expect(result.filename).toBe('lecture.txt')
  })

  it('txt omits timestamps by default and includes them on request', () => {
    const plain = buildExport('txt', 'x.mp4', meta, segments).content
    expect(plain).not.toContain('[')
    const withTs = buildExport('txt', 'x.mp4', meta, segments, {
      includeTimestamps: true,
    }).content
    expect(withTs).toContain('[0:00 → 0:02] 第一句')
    expect(withTs).toContain('[0:02 → 0:05] 第二句')
  })

  it('md switches between time table and plain list', () => {
    const table = buildExport('md', 'x.mp4', meta, segments).content
    expect(table).toContain('| 时间 | 内容 |')
    const list = buildExport('md', 'x.mp4', meta, segments, {
      includeTimestamps: false,
    }).content
    expect(list).toContain('- 第一句')
    expect(list).not.toContain('| 时间 |')
  })

  it('srt/vtt keep timestamps regardless of the option (format requirement)', () => {
    for (const format of ['srt', 'vtt'] as const) {
      const result = buildExport(format, 'x.mp4', meta, segments, {
        includeTimestamps: false,
      }).content
      expect(result).toContain(' --> ')
    }
  })
})

describe('downloadText', () => {
  it('creates an anchor and revokes the object URL', () => {
    const urls: string[] = []
    const revoke = vi.fn()
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL(blob: Blob) {
          urls.push(`blob:${blob.size}`)
          return urls[urls.length - 1]
        }
        static revokeObjectURL(url: string) {
          revoke(url)
        }
      },
    )
    const click = vi.fn()
    const anchor = {
      click,
      set href(_v: string) {},
      set download(_v: string) {},
    } as unknown as HTMLAnchorElement
    vi.spyOn(document, 'createElement').mockReturnValue(anchor)
    downloadText('a.txt', 'hello')
    expect(click).toHaveBeenCalled()
    expect(revoke).toHaveBeenCalledWith(urls[0])
    vi.unstubAllGlobals()
  })
})
