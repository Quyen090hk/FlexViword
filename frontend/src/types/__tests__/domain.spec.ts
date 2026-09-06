import { describe, expect, it } from 'vitest'
import { mediaKindOf } from '../domain'

describe('mediaKindOf', () => {
  it('classifies by mime first', () => {
    expect(mediaKindOf('audio/mpeg', 'x.mp3')).toBe('audio')
    expect(mediaKindOf('video/mp4', 'x.mp4')).toBe('video')
    expect(mediaKindOf('audio/webm', 'x.webm')).toBe('audio')
  })

  it('falls back to extension when mime is missing', () => {
    expect(mediaKindOf('', 'song.flac')).toBe('audio')
    expect(mediaKindOf('', 'movie.mkv')).toBe('video')
  })

  it('treats ambiguous webm without mime as video', () => {
    expect(mediaKindOf('', 'clip.webm')).toBe('video')
  })

  it('defaults unknown types to video', () => {
    expect(mediaKindOf('application/octet-stream', 'file.bin')).toBe('video')
  })
})
