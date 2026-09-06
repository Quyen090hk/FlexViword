// Vitest 全局环境：IndexedDB 相关代码在 Node 里需要 polyfill 才能工作
import 'fake-indexeddb/auto'

// jsdom 没有 URL.createObjectURL / revokeObjectURL，播放器与导出依赖它们
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = (obj: Blob | MediaSource) => {
    const blob = obj as Blob
    return `blob:mock:${blob.size ?? 0}`
  }
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => {}
}

if (typeof window !== 'undefined') {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}
