import { onScopeDispose, ref } from 'vue'
import { t } from '@/i18n'

export type RecorderState = 'idle' | 'recording' | 'error'

/**
 * 麦克风录音（MediaRecorder）：
 * - start 申请权限并开录（计时），stop 返回封装好的音频 File（webm/opus 或 m4a），
 *   直接交给任务管线（ffmpeg 对两种容器都能解码为 16k WAV）；
 * - 卸载时自动停止并释放麦克风。
 * 说明：Whisper 非流式，本方案是「录完整段再转写」，不是边说边出字的实时字幕。
 */
export function useRecorder() {
  const state = ref<RecorderState>('idle')
  const elapsedSec = ref(0)
  const error = ref('')

  let recorder: MediaRecorder | null = null
  let stream: MediaStream | null = null
  let chunks: Blob[] = []
  let timer: ReturnType<typeof setInterval> | null = null

  function stopTracking(): void {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
  }

  function cleanup(): void {
    stopTracking()
    recorder = null
    chunks = []
  }

  async function start(): Promise<boolean> {
    if (state.value === 'recording') return false
    error.value = ''
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      state.value = 'error'
      error.value = t('input.micDenied')
      return false
    }

    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
    const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported(type))
    chunks = []
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    } catch {
      state.value = 'error'
      error.value = t('input.micDenied')
      stopTracking()
      return false
    }

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    recorder.start(1000)
    elapsedSec.value = 0
    state.value = 'recording'
    timer = setInterval(() => {
      elapsedSec.value += 1
    }, 1000)
    return true
  }

  function stop(): Promise<File | null> {
    return new Promise((resolve) => {
      if (state.value !== 'recording' || !recorder) {
        resolve(null)
        return
      }
      const current = recorder
      const mimeType = current.mimeType || 'audio/webm'
      current.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType })
        cleanup()
        state.value = 'idle'
        if (blob.size === 0) {
          resolve(null)
          return
        }
        const ext = mimeType.includes('mp4') ? 'm4a' : 'webm'
        const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
        resolve(new File([blob], `${t('input.recordName')} ${stamp}.${ext}`, { type: mimeType }))
      }
      current.stop()
    })
  }

  onScopeDispose(() => {
    if (state.value === 'recording') {
      recorder?.stop()
    }
    stopTracking()
  })

  return { state, elapsedSec, error, start, stop }
}
