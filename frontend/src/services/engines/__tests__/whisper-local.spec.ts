import { describe, expect, it } from 'vitest'
import { chunksToSegments } from '../whisper-local'

describe('chunksToSegments', () => {
  it('maps real whisper timestamps into segments', () => {
    const { segments, estimated } = chunksToSegments(
      [
        { start: 0, end: 2.4, text: ' Hello world.' },
        { start: 2.4, end: 5.1, text: ' Second sentence' },
      ],
      5.4,
    )
    expect(estimated).toBe(false)
    expect(segments).toHaveLength(2)
    expect(segments[0]).toMatchObject({ start: 0, end: 2.4, text: 'Hello world.' })
    expect(segments[1]?.text).toBe('Second sentence')
    expect(new Set(segments.map((s) => s.id)).size).toBe(2)
  })

  it('fills null trailing end with the audio duration', () => {
    const { segments } = chunksToSegments([{ start: 1, end: null, text: '末段' }], 9)
    expect(segments[0]?.end).toBe(9)
  })

  it('never produces inverted ranges when duration is unknown', () => {
    const { segments } = chunksToSegments([{ start: 3, end: null, text: 'x' }], 0)
    expect(segments[0]!.end).toBeGreaterThanOrEqual(segments[0]!.start)
    expect(segments[0]!.end).toBe(5)
  })

  it('drops empty chunks and reports estimated=true when nothing remains', () => {
    const { segments, estimated } = chunksToSegments(
      [
        { start: 0, end: 1, text: '   ' },
        { start: 1, end: 2, text: '' },
      ],
      2,
    )
    expect(segments).toHaveLength(0)
    expect(estimated).toBe(true)
  })
})
