import { defineStore } from 'pinia'
import { ref } from 'vue'
import { uid } from '@/utils/id'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  message: string
}

export const useUiStore = defineStore('ui', () => {
  const toasts = ref<ToastItem[]>([])
  /** 全局命令面板（⌘K）开关 */
  const paletteOpen = ref(false)

  function toast(type: ToastType, message: string, timeout = 4200): void {
    const item: ToastItem = { id: uid('toast'), type, message }
    toasts.value.push(item)
    setTimeout(() => dismiss(item.id), timeout)
  }

  function dismiss(id: string): void {
    toasts.value = toasts.value.filter((item) => item.id !== id)
  }

  function openPalette(): void {
    paletteOpen.value = true
  }

  function closePalette(): void {
    paletteOpen.value = false
  }

  function togglePalette(): void {
    paletteOpen.value = !paletteOpen.value
  }

  return { toasts, toast, dismiss, paletteOpen, openPalette, closePalette, togglePalette }
})
