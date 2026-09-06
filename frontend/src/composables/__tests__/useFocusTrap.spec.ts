import { describe, expect, it } from 'vitest'
import { getFocusableElements, trapTab } from '../useFocusTrap'

function fakeEl(id: string): HTMLElement {
  return { id, focus: () => {} } as unknown as HTMLElement
}

describe('trapTab', () => {
  const [a, b, c] = [fakeEl('a'), fakeEl('b'), fakeEl('c')]

  it('lets the browser move focus inside the list', () => {
    expect(trapTab([a, b, c], a, false)).toBeNull()
    expect(trapTab([a, b, c], b, false)).toBeNull()
    expect(trapTab([a, b, c], c, true)).toBeNull()
    expect(trapTab([a, b, c], b, true)).toBeNull()
  })

  it('wraps forward from the last element', () => {
    expect(trapTab([a, b, c], c, false)).toBe(a)
  })

  it('wraps backward from the first element with shift', () => {
    expect(trapTab([a, b, c], a, true)).toBe(c)
  })

  it('pulls focus in from outside the container', () => {
    const outside = fakeEl('outside')
    expect(trapTab([a, b, c], outside, false)).toBe(a)
    expect(trapTab([a, b, c], outside, true)).toBe(c)
  })

  it('returns null for an empty focusable list', () => {
    expect(trapTab([], a, false)).toBeNull()
  })
})

describe('getFocusableElements', () => {
  it('collects visible focusable descendants and skips disabled/hidden ones', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <button id="ok">ok</button>
      <button id="off" disabled>off</button>
      <input id="hidden-input" type="hidden" />
      <a id="link" href="#x">link</a>
      <span id="plain">plain</span>
    `
    document.body.appendChild(root)
    const ids = getFocusableElements(root).map((el) => el.id)
    expect(ids).toContain('ok')
    expect(ids).toContain('link')
    expect(ids).not.toContain('off')
    expect(ids).not.toContain('hidden-input')
    expect(ids).not.toContain('plain')
    root.remove()
  })
})
