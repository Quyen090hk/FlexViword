import { describe, expect, it } from 'vitest'
import { estimateSegments, singleSegment, splitSentences } from '../text'

describe('splitSentences', () => {
  it('splits on Chinese punctuation and keeps it', () => {
    const sentences = splitSentences('你好世界。这是第二句！第三句来了；')
    expect(sentences).toHaveLength(3)
    expect(sentences[0]).toBe('你好世界。')
    expect(sentences[1]).toBe('这是第二句！')
    expect(sentences[2]).toBe('第三句来了；')
  })

  it('splits English sentences by period followed by space', () => {
    expect(splitSentences('Hello world. Second one.')).toHaveLength(2)
  })

  it('returns empty for blank text', () => {
    expect(splitSentences('   ')).toHaveLength(0)
  })

  it('merges tiny fragments back', () => {
    const sentences = splitSentences('好。好。这是一个足够长的句子。')
    expect(sentences[sentences.length - 1]).toContain('足够长')
  })
})

describe('estimateSegments', () => {
  const text = '第一句话，用于测试。第二句话稍长一些，用于验证时间分配。第三句。'

  it('creates sequential non-overlapping segments covering the duration', () => {
    const segments = estimateSegments(text, 30)
    expect(segments.length).toBeGreaterThan(2)
    expect(segments[0]?.start).toBe(0)
    expect(segments[segments.length - 1]?.end).toBeCloseTo(30)
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i]?.start).toBeCloseTo(segments[i - 1]?.end ?? 0)
    }
  })

  it('assigns longer sentences a longer span', () => {
    const segments = estimateSegments('短短。这一句远远长于上一句，所以时间应该更多。', 20)
    const [first, second] = segments
    expect(second!.end - second!.start).toBeGreaterThan(first!.end - first!.start)
  })

  it('estimates duration from text length when unknown', () => {
    const segments = estimateSegments('这是一段没有视频时长的文本。')
    expect(segments[0]?.end).toBeGreaterThan(0)
  })

  it('returns unique ids', () => {
    const segments = estimateSegments('A。B。C。D。', 10)
    expect(new Set(segments.map((s) => s.id)).size).toBe(segments.length)
  })
})

describe('singleSegment', () => {
  it('wraps plain text with a fallback duration', () => {
    const segment = singleSegment('一段话', 12)
    expect(segment.start).toBe(0)
    expect(segment.end).toBe(12)
    expect(segment.text).toBe('一段话')
  })
})
