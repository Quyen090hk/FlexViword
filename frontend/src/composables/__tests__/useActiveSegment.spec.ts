import { describe, expect, it } from 'vitest'
import { findSegmentIndexAt } from '../useActiveSegment'
import type { TranscriptSegment } from '@/types/domain'

const segments: TranscriptSegment[] = [
  { id: '1', start: 0, end: 2, text: 'a' },
  { id: '2', start: 2, end: 4, text: 'b' },
  { id: '3', start: 6, end: 8, text: 'c' },
]

describe('findSegmentIndexAt', () => {
  it('returns -1 before the first segment', () => {
    expect(findSegmentIndexAt([], 0)).toBe(-1)
  })

  it('hits the segment containing the time', () => {
    expect(findSegmentIndexAt(segments, 1)).toBe(0)
    expect(findSegmentIndexAt(segments, 3)).toBe(1)
    expect(findSegmentIndexAt(segments, 7)).toBe(2)
  })

  it('keeps the previous segment inside gaps (subtitle convention)', () => {
    expect(findSegmentIndexAt(segments, 5)).toBe(1)
  })

  it('returns -1 before first start', () => {
    const shifted = [{ id: '0', start: 5, end: 6, text: 'x' }]
    expect(findSegmentIndexAt(shifted, 0)).toBe(-1)
  })
})
