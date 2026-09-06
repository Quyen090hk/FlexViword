/**
 * 16-bit PCM WAV 解析。
 * 我们的音频提取端（ffmpeg.wasm / 桌面 Go）固定输出 pcm_s16le、16kHz、单声道，
 * 所以可以绕过 AudioContext.decodeAudioData —— 它会把音频重采样到硬件采样率，
 * 而 Whisper 固定需要 16kHz 输入。直接读 PCM 最稳、零重采样。
 * encodeWavPcm16 主要服务于测试的往返验证（也可用于未来的音频导出）。
 */

export interface DecodedWav {
  sampleRate: number
  /** [-1, 1] 归一化采样；多声道时为平均下混 */
  samples: Float32Array
}

function readAscii(view: DataView, offset: number, length: number): string {
  let out = ''
  for (let i = 0; i < length; i++) out += String.fromCharCode(view.getUint8(offset + i))
  return out
}

export function decodeWavPcm16(buffer: ArrayBuffer): DecodedWav {
  const view = new DataView(buffer)
  if (
    view.byteLength < 44 ||
    readAscii(view, 0, 4) !== 'RIFF' ||
    readAscii(view, 8, 4) !== 'WAVE'
  ) {
    throw new Error('Not a WAV file (RIFF/WAVE header missing)')
  }

  let audioFormat = 1
  let channels = 1
  let sampleRate = 16000
  let bitsPerSample = 16
  let dataOffset = -1
  let dataLength = 0

  let offset = 12
  while (offset + 8 <= view.byteLength) {
    const id = readAscii(view, offset, 4)
    const size = view.getUint32(offset + 4, true)
    if (id === 'fmt ') {
      audioFormat = view.getUint16(offset + 8, true)
      channels = view.getUint16(offset + 10, true)
      sampleRate = view.getUint32(offset + 12, true)
      bitsPerSample = view.getUint16(offset + 22, true)
    } else if (id === 'data') {
      dataOffset = offset + 8
      dataLength = Math.min(size, view.byteLength - dataOffset)
    }
    offset += 8 + size + (size % 2) // chunk 按字（2 字节）对齐
  }

  if (dataOffset < 0) throw new Error('WAV data chunk missing')
  if (audioFormat !== 1) throw new Error(`Unsupported WAV format (${audioFormat}), PCM only`)
  if (bitsPerSample !== 16) throw new Error(`Unsupported bit depth (${bitsPerSample}), 16-bit only`)
  if (channels < 1 || channels > 2) throw new Error(`Unsupported channel count (${channels})`)

  const frameCount = Math.floor(dataLength / 2 / channels)
  const samples = new Float32Array(frameCount)
  for (let i = 0; i < frameCount; i++) {
    let sum = 0
    for (let c = 0; c < channels; c++) {
      sum += view.getInt16(dataOffset + (i * channels + c) * 2, true)
    }
    samples[i] = sum / channels / 32768
  }

  return { sampleRate, samples }
}

/** 测试/导出用：把 Float32 采样编码为 16-bit 单声道 WAV */
export function encodeWavPcm16(samples: Float32Array, sampleRate = 16000): ArrayBuffer {
  const dataLength = samples.length * 2
  const buffer = new ArrayBuffer(44 + dataLength)
  const view = new DataView(buffer)

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }

  writeAscii(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeAscii(8, 'WAVE')
  writeAscii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(36, 'data')
  view.setUint32(40, dataLength, true)

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i] ?? 0))
    view.setInt16(44 + i * 2, Math.round(clamped * 32767), true)
  }
  return buffer
}
