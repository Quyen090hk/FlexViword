import { describe, expect, it } from 'vitest'
import { decodeWavPcm16, encodeWavPcm16 } from '../wav'

describe('decodeWavPcm16 / encodeWavPcm16', () => {
  it('roundtrips mono samples', () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1])
    const decoded = decodeWavPcm16(encodeWavPcm16(samples, 16000))
    expect(decoded.sampleRate).toBe(16000)
    expect(decoded.samples).toHaveLength(samples.length)
    expect(decoded.samples[1]).toBeCloseTo(0.5, 4)
    expect(decoded.samples[3]).toBeCloseTo(1, 4)
  })

  it('downmixes stereo by averaging', () => {
    // 手工构造立体声 WAV：左 32767（≈1.0），右 -32768（≈-1.0）→ 平均 ≈ 0
    const dataLength = 4
    const buffer = new ArrayBuffer(44 + dataLength)
    const view = new DataView(buffer)
    const write = (offset: number, text: string) => {
      for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
    }
    write(0, 'RIFF')
    view.setUint32(4, 36 + dataLength, true)
    write(8, 'WAVE')
    write(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 2, true) // stereo
    view.setUint32(24, 16000, true)
    view.setUint32(28, 64000, true)
    view.setUint16(32, 4, true)
    view.setUint16(34, 16, true)
    write(36, 'data')
    view.setUint32(40, dataLength, true)
    view.setInt16(44, 32767, true)
    view.setInt16(46, -32768, true)

    const decoded = decodeWavPcm16(buffer)
    expect(decoded.samples).toHaveLength(1)
    expect(decoded.samples[0]).toBeCloseTo((32767 / 32768 + -1) / 2, 4)
  })

  it('rejects non-WAV buffers', () => {
    expect(() => decodeWavPcm16(new ArrayBuffer(64))).toThrow(/WAV/)
    expect(() => decodeWavPcm16(new ArrayBuffer(10))).toThrow(/WAV/)
  })

  it('rejects non-PCM formats and unsupported bit depths', () => {
    const valid = encodeWavPcm16(new Float32Array(4))
    const view = new DataView(valid)
    view.setUint16(20, 3, true) // audioFormat = 3 (IEEE float)
    expect(() => decodeWavPcm16(valid)).toThrow(/PCM/)
    const valid2 = encodeWavPcm16(new Float32Array(4))
    const view2 = new DataView(valid2)
    view2.setUint16(34, 8, true) // 8-bit
    expect(() => decodeWavPcm16(valid2)).toThrow(/bit depth/)
  })
})
