import type { TranscriptSegment } from '@/types/domain'
import { uid } from './id'

/**
 * 无时间戳的纯文本（SenseVoice 这类模型只返回整段文本）如何变成可同步的字幕：
 * 1. splitSentences 按中英文标点断句；
 * 2. estimateSegments 按每句字数占比把总时长“加权分配”到各句，
 *    得到近似时间轴（meta.timingEstimated = true 标记为估算）。
 */

// 注意：lookbehind 内必须用非捕获组(?:...)，否则 String.split 会把捕获组结果插进数组
const SENTENCE_SPLIT_RE = /(?<=[。！？；!?;])|(?<=\.(?:\s|$))/g

export function splitSentences(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []
  const raw = normalized.split(SENTENCE_SPLIT_RE)
  const merged: string[] = []
  for (const part of raw) {
    const piece = part.trim()
    if (!piece) continue
    const prev = merged[merged.length - 1]
    // 过短的碎片（≤2 字符）并回上一句，避免出现单字字幕
    if (prev && piece.length <= 2) {
      merged[merged.length - 1] = `${prev}${piece}`
    } else {
      merged.push(piece)
    }
  }
  return merged.length > 0 ? merged : [normalized]
}

export function estimateSegments(
  text: string,
  durationSec?: number,
  opts: { minDuration?: number } = {},
): TranscriptSegment[] {
  const sentences = splitSentences(text)
  if (sentences.length === 0) return []
  const totalChars = sentences.reduce((sum, s) => sum + s.length, 0)
  // 时长未知时按普通话播音语速 ≈ 4 字/秒 估算
  const duration =
    durationSec && durationSec > 0
      ? Math.max(durationSec, sentences.length * (opts.minDuration ?? 1))
      : Math.max(2, totalChars / 4)
  let cursor = 0
  return sentences.map((sentence, i) => {
    const isLast = i === sentences.length - 1
    const span = (sentence.length / totalChars) * duration
    const start = cursor
    const end = isLast ? duration : start + span
    cursor = end
    return { id: uid('seg'), start, end, text: sentence }
  })
}

/** 兜底：把整段文本包装成单条字幕 */
export function singleSegment(text: string, durationSec?: number): TranscriptSegment {
  return {
    id: uid('seg'),
    start: 0,
    end: durationSec ?? Math.max(2, text.length / 4),
    text: text.trim(),
  }
}
