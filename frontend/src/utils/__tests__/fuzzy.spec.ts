import { describe, expect, it } from 'vitest'
import { fuzzyFilter, fuzzyMatch, splitByIndices } from '../fuzzy'

describe('fuzzyMatch', () => {
  it('matches subsequence in order', () => {
    expect(fuzzyMatch('wrk', '工作台 workspace')).not.toBeNull()
    expect(fuzzyMatch('wks', '工作台 workspace')).not.toBeNull()
  })

  it('rejects out-of-order or missing characters', () => {
    expect(fuzzyMatch('kz', '工作台 workspace')).toBeNull()
    expect(fuzzyMatch('flowx', 'SiliconFlow')).toBeNull()
  })

  it('is case-insensitive', () => {
    const result = fuzzyMatch('sf', 'SiliconFlow')
    expect(result).not.toBeNull()
    // S(词首) 与 F(驼峰边界 = 词首) 命中，得分应为正
    expect(result!.score).toBeGreaterThan(0)
  })

  it('rewards word-start hits over mid-word hits', () => {
    const wordStart = fuzzyMatch('f', 'SiliconFlow')!
    const midWord = fuzzyMatch('l', 'SiliconFlow')!
    expect(wordStart.score).toBeGreaterThan(midWord.score)
  })

  it('prefers compact hits via span penalty', () => {
    const compact = fuzzyMatch('ab', 'ab...xxxx...ab')!
    // "ab" 在开头的紧凑命中 vs 结尾的松散命中，取最优
    expect(compact.indices).toEqual([0, 1])
  })

  it('rewards consecutive characters', () => {
    const consecutive = fuzzyMatch('work', 'workspace')!
    expect(consecutive.indices).toEqual([0, 1, 2, 3])
    expect(consecutive.score).toBeGreaterThan(20)
  })

  it('returns empty indices for empty query', () => {
    expect(fuzzyMatch('', 'anything')).toEqual({ score: 0, indices: [] })
  })
})

describe('fuzzyFilter', () => {
  const items = ['SiliconFlow 引擎', '离线演示引擎', '工作台']

  it('filters and sorts by score descending', () => {
    const results = fuzzyFilter('引擎', items, (item) => item)
    expect(results.length).toBe(2)
    expect(results[0]?.item).toBe(items[0]) // 更长的命中差距不大时按分数排
  })

  it('returns everything for empty query', () => {
    expect(fuzzyFilter('', items, (item) => item)).toHaveLength(items.length)
  })
})

describe('splitByIndices', () => {
  it('splits text into hit/normal parts', () => {
    const parts = splitByIndices('SiliconFlow', [0, 7])
    expect(parts).toEqual([
      { text: 'S', hit: true },
      { text: 'ilicon', hit: false },
      { text: 'F', hit: true },
      { text: 'low', hit: false },
    ])
  })

  it('returns single part when no indices', () => {
    expect(splitByIndices('abc', [])).toEqual([{ text: 'abc', hit: false }])
  })
})
