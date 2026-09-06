import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'

/**
 * 固定行高虚拟列表。
 * 固定行高下可见起点 = floor(scrollTop / itemHeight)，O(1)；
 * 若将来支持可变行高，改为「前缀和数组 + 二分查找」即可，对组件层接口零影响。
 */
export interface VirtualItem<T> {
  item: T
  index: number
  offset: number
}

export interface VirtualListOptions<T> {
  items: Ref<T[]>
  itemHeight: number
  overscan?: number
  container: Ref<HTMLElement | null>
}

export function useVirtualList<T>(options: VirtualListOptions<T>) {
  const { items, itemHeight, overscan = 6, container } = options
  const scrollTop = ref(0)
  const viewportHeight = ref(480)

  function measure(): void {
    if (container.value) viewportHeight.value = Math.max(container.value.clientHeight, 1)
  }

  // 容器尺寸变化（窗口 resize / 布局折叠）时重新测量，否则可视窗口计算会过期
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => measure())
    watch(
      container,
      (el, prev) => {
        if (prev) observer.unobserve(prev)
        if (el) observer.observe(el)
      },
      { immediate: true },
    )
    onScopeDispose(() => observer.disconnect())
  }

  function onScroll(): void {
    if (container.value) {
      scrollTop.value = container.value.scrollTop
      viewportHeight.value = Math.max(container.value.clientHeight, 1)
    }
  }

  const totalHeight = computed(() => items.value.length * itemHeight)

  const range = computed(() => {
    const start = Math.max(0, Math.floor(scrollTop.value / itemHeight) - overscan)
    const visibleCount = Math.ceil(viewportHeight.value / itemHeight) + overscan * 2
    const end = Math.min(items.value.length, start + visibleCount)
    return { start, end }
  })

  const virtualItems = computed<VirtualItem<T>[]>(() => {
    const { start, end } = range.value
    const result: VirtualItem<T>[] = []
    for (let i = start; i < end; i += 1) {
      const item = items.value[i]
      if (item !== undefined) result.push({ item, index: i, offset: i * itemHeight })
    }
    return result
  })

  function scrollToIndex(index: number, behavior: ScrollBehavior = 'auto'): void {
    const el = container.value
    if (!el) return
    const top = Math.max(0, index * itemHeight)
    el.scrollTo({ top, behavior })
  }

  return { virtualItems, totalHeight, onScroll, measure, scrollToIndex }
}
