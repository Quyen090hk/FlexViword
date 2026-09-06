import { describe, expect, it } from 'vitest'
import { clamp, formatBytes, formatDuration, formatTimecode, parseTimecode } from '../time'

describe('formatDuration', () => {
  it('formats minutes and seconds', () => {
    expect(formatDuration(92)).toBe('1:32')
  })

  it('formats hours', () => {
    expect(formatDuration(3700)).toBe('1:01:40')
  })

  it('floors and clamps negatives', () => {
    expect(formatDuration(92.9)).toBe('1:32')
    expect(formatDuration(-5)).toBe('0:00')
  })
})

describe('formatTimecode', () => {
  it('renders SRT timecodes with comma', () => {
    expect(formatTimecode(92.5)).toBe('00:01:32,500')
  })

  it('renders VTT timecodes with dot', () => {
    expect(formatTimecode(3661.001, '.')).toBe('01:01:01.001')
  })

  it('pads milliseconds to 3 digits', () => {
    expect(formatTimecode(1.2)).toBe('00:00:01,200')
  })
})

describe('parseTimecode', () => {
  it('parses full timecodes', () => {
    expect(parseTimecode('00:01:32,500')).toBeCloseTo(92.5)
  })

  it('parses short forms and raw seconds', () => {
    expect(parseTimecode('01:32.5')).toBeCloseTo(92.5)
    expect(parseTimecode('92.5')).toBeCloseTo(92.5)
  })

  it('rejects invalid input', () => {
    expect(parseTimecode('')).toBeNull()
    expect(parseTimecode('abc')).toBeNull()
    expect(parseTimecode('1:2:3:4')).toBeNull()
    expect(parseTimecode('-1')).toBeNull()
  })
})

describe('clamp', () => {
  it('clamps into range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(11, 0, 10)).toBe(10)
  })
})

describe('formatBytes', () => {
  it('formats units', () => {
    expect(formatBytes(500)).toBe('500 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatBytes(Number.NaN)).toBe('-')
  })
})
