import type { TranscriptSegment } from '@/types/domain'
import { clamp } from './time'

/**
 * 转写结果统计：纯函数计算，供统计面板与命令面板复用。
 * durationSec 缺省时取最后一段的结束时间。
 */
export interface TranscriptStats {
  segmentCount: number
  /** 去除空白后的字符数 */
  charCount: number
  durationSec: number
  /** 语速（字/分钟） */
  charsPerMinute: number
  /** 时间覆盖率：有字幕的时间占总时长比例 0-1 */
  coverage: number
  /** 字符密度直方图：等宽时间桶内字符数（用于分布图） */
  histogram: number[]
  histogramPeak: number
}

export const HISTOGRAM_BUCKETS = 24

export function computeTranscriptStats(
  segments: TranscriptSegment[],
  durationSec?: number,
): TranscriptStats {
  const duration =
    durationSec && durationSec > 0 ? durationSec : (segments[segments.length - 1]?.end ?? 0)
  const histogram: number[] = new Array<number>(HISTOGRAM_BUCKETS).fill(0)
  let charCount = 0
  let spokenSec = 0

  for (const segment of segments) {
    const chars = segment.text.replace(/\s/g, '').length
    charCount += chars
    if (duration <= 0 || chars === 0) continue
    const start = clamp(segment.start, 0, duration)
    const end = clamp(segment.end, 0, duration)
    // 覆盖率只统计有实际内容的句段（空段不代表有语音）
    spokenSec += Math.max(0, end - start)
    const startBucket = clamp(
      Math.floor((start / duration) * HISTOGRAM_BUCKETS),
      0,
      HISTOGRAM_BUCKETS - 1,
    )
    const endBucket = clamp(
      Math.floor((Math.max(end - 0.001, 0) / duration) * HISTOGRAM_BUCKETS),
      0,
      HISTOGRAM_BUCKETS - 1,
    )
    // 字符均匀摊到覆盖的时间桶，避免长句把单个桶撑爆
    const bucketSpan = endBucket - startBucket + 1
    const perBucket = chars / bucketSpan
    for (let b = startBucket; b <= endBucket; b++) histogram[b] = (histogram[b] ?? 0) + perBucket
  }

  const histogramPeak = histogram.reduce((max, v) => Math.max(max, v), 0)
  return {
    segmentCount: segments.length,
    charCount,
    durationSec: duration,
    charsPerMinute: duration > 0 ? (charCount / duration) * 60 : 0,
    coverage: duration > 0 ? Math.min(1, spokenSec / duration) : 0,
    histogram,
    histogramPeak,
  }
}
