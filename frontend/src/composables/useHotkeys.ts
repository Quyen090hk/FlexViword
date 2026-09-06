import { onMounted, onUnmounted } from 'vue'

export interface HotkeyBinding {
  /**
   * 组合键语法（不区分大小写）：
   * - 单键：' '（空格）、'arrowleft'、'k'
   * - 修饰键组合：'mod+k'、'mod+shift+z'（mod = Ctrl 或 Cmd）
   * 未声明的修饰键被按下时不匹配，避免 mod+k 误吞 mod+shift+k。
   */
  key: string
  /** 输入框聚焦时是否仍触发（命令类快捷键应设 true） */
  allowInInput?: boolean
  handler: (event: KeyboardEvent) => void
}

interface ParsedBinding {
  mod: boolean
  shift: boolean
  alt: boolean
  main: string
}

function parse(key: string): ParsedBinding {
  const parts = key.toLowerCase().split('+')
  return {
    mod: parts.includes('mod'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    main: parts[parts.length - 1] ?? '',
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return (
    el !== null && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
  )
}

function matches(binding: ParsedBinding, event: KeyboardEvent): boolean {
  const modPressed = event.metaKey || event.ctrlKey
  if (binding.mod !== modPressed) return false
  if (binding.shift !== event.shiftKey) return false
  if (binding.alt !== event.altKey) return false
  return event.key.toLowerCase() === binding.main
}

/** 全局快捷键：默认输入控件聚焦时失效（打字不触发），allowInInput 可豁免 */
export function useHotkeys(bindings: HotkeyBinding[]): void {
  const parsed = bindings.map((binding) => ({ ...binding, parsed: parse(binding.key) }))

  const handler = (event: KeyboardEvent): void => {
    const typing = isTypingTarget(event.target)
    if (typing && !parsed.some((b) => b.allowInInput)) return

    for (const binding of parsed) {
      if (typing && !binding.allowInInput) continue
      if (matches(binding.parsed, event)) {
        event.preventDefault()
        binding.handler(event)
        return
      }
    }
  }

  onMounted(() => window.addEventListener('keydown', handler))
  onUnmounted(() => window.removeEventListener('keydown', handler))
}
