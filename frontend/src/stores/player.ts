import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 播放器协调中心：<video> 元素被 VideoPlayer 组件持有，
 * 但「当前句」「跳转请求」需要跨组件（字幕列表 ↔ 播放器）双向通信。
 * seek 用 {at, token} 而不是裸时间：同一时间的重复跳转也能触发 watch。
 */
export const usePlayerStore = defineStore('player', () => {
  const isPlaying = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  /** 当前播放到的字幕段 id（二分查找结果，rAF 频率更新） */
  const activeSegmentId = ref<string | null>(null)
  const seekRequest = ref<{ at: number; token: number } | null>(null)

  function requestSeek(at: number): void {
    const token = (seekRequest.value?.token ?? 0) + 1
    seekRequest.value = { at, token }
  }

  function reset(): void {
    isPlaying.value = false
    currentTime.value = 0
    duration.value = 0
    activeSegmentId.value = null
    seekRequest.value = null
  }

  return { isPlaying, currentTime, duration, activeSegmentId, seekRequest, requestSeek, reset }
})
