import { nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useVirtualList } from '../useVirtualList'

describe('useVirtualList', () => {
  const items = ref(Array.from({ length: 1000 }, (_, i) => i))

  function setup(scrollTop = 0) {
    const container = ref<HTMLElement | null>({
      scrollTop,
      clientHeight: 640,
      scrollTo: () => {},
    } as unknown as HTMLElement)
    const list = useVirtualList({ items, itemHeight: 64, container })
    return { container, list }
  }

  it('renders only the visible window plus overscan', () => {
    const { list } = setup(0)
    expect(list.virtualItems.value.length).toBeLessThan(30)
    expect(list.totalHeight.value).toBe(1000 * 64)
    expect(list.virtualItems.value[0]?.index).toBe(0)
  })

  it('windows correctly after scrolling', async () => {
    const { container, list } = setup(6400) // 第 100 行附近
    container.value!.scrollTop = 6400
    await nextTick()
    list.onScroll()
    const indexes = list.virtualItems.value.map((v) => v.index)
    expect(indexes[0]).toBeGreaterThanOrEqual(100 - 6 - 1)
    expect(indexes[indexes.length - 1]).toBeLessThan(100 + 10 + 6 + 1)
    expect(list.virtualItems.value[0]?.offset).toBe((indexes[0] ?? 0) * 64)
  })

  it('scrollToIndex computes absolute top', () => {
    const { container, list } = setup()
    const el = container.value!
    let captured: ScrollToOptions | undefined
    el.scrollTo = ((options: ScrollToOptions) => {
      captured = options
    }) as typeof el.scrollTo
    list.scrollToIndex(50)
    expect(captured?.top).toBe(50 * 64)
  })
})
