/**
 * 子序列模糊匹配（fuzzy subsequence match），⌘K 命令面板的检索核心。
 *
 * 打分规则（越大越好）：
 * - 命中必须按顺序构成 query 的子序列，否则返回 null；
 * - 连续命中 +16/字符（连续段越长权重越高）；
 * - 词首命中（文本开头、空格/标点/驼峰边界后首字符）+14；
 * - 普通命中 +6；
 * - 段间空隙惩罚 -min(gap, 8)；
 * - 总跨度惩罚：匹配窗口越宽分数越低（偏向紧凑命中）。
 * 纯函数、无依赖，方便单测与未来移入 Worker。
 */
export interface FuzzyResult {
  score: number
  /** 命中字符在 text 中的下标（用于高亮） */
  indices: number[]
}

const CONSECUTIVE_BONUS = 16
const WORD_START_BONUS = 14
const PLAIN_BONUS = 6
const GAP_PENALTY_MAX = 8

function isWordBoundary(text: string, index: number): boolean {
  if (index === 0) return true
  const prev = text[index - 1]
  const current = text[index]
  if (/[\s\-_/·、，。：；！？,.:;!?()[\]]/.test(prev)) return true
  // 驼峰边界：前小写后大写
  return /[a-z]/.test(prev) && /[A-Z]/.test(current)
}

export function fuzzyMatch(query: string, text: string): FuzzyResult | null {
  const q = query.trim().toLowerCase()
  if (!q) return { score: 0, indices: [] }
  const lower = text.toLowerCase()

  const indices: number[] = []
  let score = 0
  let cursor = 0

  for (let qi = 0; qi < q.length; qi++) {
    const char = q[qi]
    const found = lower.indexOf(char, cursor)
    if (found === -1) return null

    if (indices.length > 0 && found === indices[indices.length - 1]! + 1) {
      score += CONSECUTIVE_BONUS
    } else if (indices.length > 0) {
      score -= Math.min(found - cursor, GAP_PENALTY_MAX)
    }
    if (isWordBoundary(text, found)) score += WORD_START_BONUS
    else score += PLAIN_BONUS

    indices.push(found)
    cursor = found + 1
  }

  // 跨度惩罚：同样命中，窗口更紧凑者更优
  const span = indices[indices.length - 1]! - indices[0]! + 1
  score -= Math.max(0, span - q.length) * 0.4

  return { score, indices }
}

/** 批量检索：按分数降序，null 结果被过滤 */
export function fuzzyFilter<T>(
  query: string,
  items: T[],
  getText: (item: T) => string,
): Array<{ item: T; match: FuzzyResult }> {
  const results: Array<{ item: T; match: FuzzyResult }> = []
  for (const item of items) {
    const match = fuzzyMatch(query, getText(item))
    if (match) results.push({ item, match })
  }
  return results.sort((a, b) => b.match.score - a.match.score)
}

/** 给定命中的下标，把文本切成 [普通, 命中, 普通...] 片段，供模板高亮 */
export function splitByIndices(
  text: string,
  indices: number[],
): Array<{ text: string; hit: boolean }> {
  if (indices.length === 0) return [{ text, hit: false }]
  const parts: Array<{ text: string; hit: boolean }> = []
  const set = new Set(indices)
  let buffer = ''
  let bufferHit: boolean | null = null

  for (let i = 0; i < text.length; i++) {
    const hit = set.has(i)
    if (bufferHit === hit) {
      buffer += text[i]
    } else {
      if (buffer) parts.push({ text: buffer, hit: bufferHit ?? false })
      buffer = text[i]!
      bufferHit = hit
    }
  }
  if (buffer) parts.push({ text: buffer, hit: bufferHit ?? false })
  return parts
}
