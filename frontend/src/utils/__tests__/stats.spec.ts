import { describe, expect, it } from 'vitest'
import { computeTranscriptStats, HISTOGRAM_BUCKETS } from '../stats'
import type { TranscriptSegment } from '@/types/domain'

const segments: TranscriptSegment[] = [
  { id: 'a', start: 0, end: 10, text: '第一句话，一共十个字左右' },
  { id: 'b', start: 10, end: 20, text: '' },
  { id: 'c', start: 30, end: 40, text: '第二段内容' },
]

describe('computeTranscriptStats', () => {
  it('counts characters excluding whitespace', () => {
    const stats = computeTranscriptStats(segments)
    expect(stats.segmentCount).toBe(3)
    expect(stats.charCount).toBe(segments[0]!.text.length + segments[2]!.text.length)
  })

  it('falls back to last segment end when duration unknown', () => {
    const stats = computeTranscriptStats(segments)
    expect(stats.durationSec).toBe(40)
  })

  it('computes pace in chars per minute', () => {
    const stats = computeTranscriptStats(segments)
    const expected = ((segments[0]!.text.length + segments[2]!.text.length) / 40) * 60
    expect(stats.charsPerMinute).toBeCloseTo(expected)
  })

  it('computes coverage as spoken time ratio', () => {
    const stats = computeTranscriptStats(segments)
    // 10 + 10 = 20s / 40s
    expect(stats.coverage).toBeCloseTo(0.5)
  })

  it('builds a fixed-size histogram with chars spread across buckets', () => {
    const stats = computeTranscriptStats(segments)
    expect(stats.histogram).toHaveLength(HISTOGRAM_BUCKETS)
    const total = stats.histogram.reduce((sum, v) => sum + v, 0)
    expect(total).toBeCloseTo(stats.charCount)
    // 第二段为空：10-20s 对应的桶应为 0
    const emptyBucket = stats.histogram[Math.floor((15 / 40) * HISTOGRAM_BUCKETS)]!
    expect(emptyBucket).toBe(0)
    expect(stats.histogramPeak).toBeGreaterThan(0)
  })

  it('handles empty input', () => {
    const stats = computeTranscriptStats([])
    expect(stats.charCount).toBe(0)
    expect(stats.durationSec).toBe(0)
    expect(stats.coverage).toBe(0)
    expect(stats.histogramPeak).toBe(0)
  })

  it('clamps segments beyond the given duration', () => {
    const stats = computeTranscriptStats(segments, 12)
    expect(stats.coverage).toBeLessThanOrEqual(1)
    const total = stats.histogram.reduce((sum, v) => sum + v, 0)
    expect(total).toBeLessThanOrEqual(stats.charCount)
  })
})
