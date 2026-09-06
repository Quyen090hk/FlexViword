import type { Platform } from '@/types/domain'

/**
 * 平台适配层。
 * 同一套业务代码需要同时运行在两种宿主里：
 * - web：纯浏览器（Vite 开发服务器 / 静态部署）
 * - wails：Wails v2 桌面壳（Go 注入 window.go / window.runtime）
 * 宿主差异全部收敛在此层，上层（stores/组件）只面向抽象编程。
 */

/** Wails v2 注入的全局对象（仅桌面壳内存在） */
interface WailsGlobal {
  go?: {
    main?: {
      App?: {
        SelectVideo: () => Promise<string>
        ConvertToAudio: (videoPath: string) => Promise<string>
        TranscribeAPI: (apiKey: string, model: string, audioPath: string) => Promise<string>
        GetVideoStreamURL: (videoPath: string) => Promise<string>
        DownloadMedia: (mediaURL: string) => Promise<string>
        ImportMediaFolder: () => Promise<Array<{
          name: string
          path: string
          size: number
          mime: string
        }> | null>
      }
    }
  }
}

export function getWailsGlobal(): WailsGlobal | undefined {
  if (typeof window === 'undefined') return undefined
  if (!('go' in window) || !('runtime' in window)) return undefined
  return window as unknown as WailsGlobal
}

export function isDesktop(): boolean {
  return getWailsGlobal()?.go?.main?.App !== undefined
}

export function detectPlatform(): Platform {
  return isDesktop() ? 'wails' : 'web'
}

export function getWailsApp() {
  const app = getWailsGlobal()?.go?.main?.App
  if (!app) throw new Error('Wails App bindings unavailable')
  return app
}
