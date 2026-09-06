import type { EngineId, Platform, TranscriptionEngine } from '@/types/domain'
import type { TranscriptionSettings } from '@/types/settings'
import { t } from '@/i18n'
import { mockEngine } from './mock'
import { siliconflowEngine } from './siliconflow'
import { wailsEngine } from './wails'
import { whisperLocalEngine } from './whisper-local'

export const engines: Record<EngineId, TranscriptionEngine> = {
  mock: mockEngine,
  siliconflow: siliconflowEngine,
  wails: wailsEngine,
  'whisper-local': whisperLocalEngine,
}

/** 某平台下各引擎的可用性（供设置页/工作台下拉展示理由） */
export interface EngineAvailability {
  id: EngineId
  ready: boolean
  supported: boolean
  reason: 'ok' | 'needs-api-key' | 'desktop-only' | 'web-only'
}

export function engineAvailability(
  platform: Platform,
  settings: TranscriptionSettings,
): EngineAvailability[] {
  const hasKey = settings.apiKey.trim().length > 0
  const list: EngineAvailability[] = [
    { id: 'mock', ready: true, supported: true, reason: 'ok' },
    { id: 'whisper-local', ready: true, supported: true, reason: 'ok' },
    {
      // 桌面壳里同一云服务由 wails 引擎经 Go 直连（无 CORS），浏览器路径标记 web-only
      id: 'siliconflow',
      ready: hasKey,
      supported: platform === 'web',
      reason: platform === 'web' ? (hasKey ? 'ok' : 'needs-api-key') : 'web-only',
    },
    {
      id: 'wails',
      ready: platform === 'wails' && hasKey,
      supported: platform === 'wails',
      reason: platform === 'wails' ? (hasKey ? 'ok' : 'needs-api-key') : 'desktop-only',
    },
  ]
  return list
}

export interface ResolvedEngine {
  engine: TranscriptionEngine
  id: EngineId
  /** 自动降级的原因，空串表示按用户选择执行 */
  fallbackReason: string
}

/**
 * 解析实际使用的引擎：
 * 1. 用户显式选择且可用 → 直接使用（含本地 whisper-local）；
 * 2. auto：桌面壳优先 wails，浏览器优先 siliconflow（需 API Key）；
 *    auto 不主动选择 whisper-local —— 首次使用需要下载模型权重，
 *    是否付出这个成本应由用户显式决定；未配置时回退 mock。
 */
export function resolveEngine(platform: Platform, settings: TranscriptionSettings): ResolvedEngine {
  const availability = engineAvailability(platform, settings)
  const pick = (id: EngineId): TranscriptionEngine => engines[id]

  if (settings.engine !== 'auto') {
    const entry = availability.find((a) => a.id === settings.engine)
    if (entry?.supported && entry.ready)
      return { engine: pick(entry.id), id: entry.id, fallbackReason: '' }
    const fallback = settings.engine === 'mock' ? 'engine.unavailable' : 'engine.fallback-mock'
    if (settings.engine === 'mock') return { engine: mockEngine, id: 'mock', fallbackReason: '' }
    return { engine: mockEngine, id: 'mock', fallbackReason: fallback }
  }

  const desktopPreferred = platform === 'wails' ? 'wails' : 'siliconflow'
  const preferred = availability.find((a) => a.id === desktopPreferred)
  if (preferred?.supported && preferred.ready) {
    return { engine: pick(preferred.id), id: preferred.id, fallbackReason: '' }
  }
  const secondary = availability.find((a) => a.id === 'siliconflow' && a.supported && a.ready)
  if (secondary) return { engine: pick('siliconflow'), id: 'siliconflow', fallbackReason: '' }
  return { engine: mockEngine, id: 'mock', fallbackReason: 'engine.auto-mock' }
}

/** 引擎展示名（工作台/设置下拉用），auto 之外未命中时回退原始 id */
export function engineDisplayName(id: string): string {
  switch (id) {
    case 'auto':
      return t('workspace.engineAuto')
    case 'mock':
      return t('engine.name.mock')
    case 'siliconflow':
      return t('engine.name.siliconflow')
    case 'wails':
      return t('engine.name.wails')
    case 'whisper-local':
      return t('engine.name.whisper')
    default:
      return id
  }
}
