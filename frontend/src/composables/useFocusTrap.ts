import { onScopeDispose, watch, type Ref } from 'vue'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function isVisible(el: HTMLElement): boolean {
  // checkVisibility 是现代浏览器的标准 API；无 layout 的测试环境退化为 hidden 检查
  if (typeof el.checkVisibility === 'function') return el.checkVisibility()
  return !el.closest('[hidden]')
}

export function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isVisible)
}

/**
 * Tab 循环的核心逻辑（纯函数，可单测）：
 * 返回应当聚焦的元素；null 表示放行浏览器默认行为。
 */
export function trapTab(
  focusable: HTMLElement[],
  current: Element | null,
  shift: boolean,
): HTMLElement | null {
  if (focusable.length === 0) return null
  const first = focusable[0]!
  const last = focusable[focusable.length - 1]!
  const inside = current !== null && focusable.includes(current as HTMLElement)
  if (shift) {
    if (!inside || current === first) return last
    return null
  }
  if (!inside || current === last) return first
  return null
}

/**
 * 对话框焦点陷阱：激活时移焦点进容器、Tab 循环限制在容器内、
 * 关闭/卸载时把焦点还给触发元素 —— WCAG 2.1 AA 对 modal 的要求。
 */
export function useFocusTrap(container: Ref<HTMLElement | null>, active: Ref<boolean>): void {
  let previouslyFocused: HTMLElement | null = null

  function onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !container.value) return
    const focusable = getFocusableElements(container.value)
    const target = trapTab(focusable, document.activeElement, event.shiftKey)
    if (target) {
      event.preventDefault()
      target.focus()
    } else if (focusable.length === 0) {
      event.preventDefault()
      container.value.focus()
    }
  }

  function activate(): void {
    previouslyFocused = document.activeElement as HTMLElement | null
    window.addEventListener('keydown', onKeydown, true)
    const focusable = container.value ? getFocusableElements(container.value) : []
    ;(focusable[0] ?? container.value)?.focus()
  }

  function deactivate(): void {
    window.removeEventListener('keydown', onKeydown, true)
    previouslyFocused?.focus?.()
    previouslyFocused = null
  }

  watch(active, (on) => (on ? activate() : deactivate()))
  onScopeDispose(() => active.value && deactivate())
}
