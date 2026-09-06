import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type TranscriptionSettings } from '@/types/settings'
import { engineAvailability, resolveEngine } from '../index'

function settings(patch: Partial<TranscriptionSettings> = {}): TranscriptionSettings {
  return { ...DEFAULT_SETTINGS, ...patch }
}

describe('engineAvailability', () => {
  it('mock is always ready', () => {
    const list = engineAvailability('web', settings())
    expect(list.find((e) => e.id === 'mock')?.ready).toBe(true)
  })

  it('whisper-local is ready on every platform (explicit choice)', () => {
    for (const platform of ['web', 'wails'] as const) {
      const entry = engineAvailability(platform, settings()).find((e) => e.id === 'whisper-local')
      expect(entry).toMatchObject({ ready: true, supported: true, reason: 'ok' })
    }
  })

  it('siliconflow needs an API key; wails is desktop-only', () => {
    const list = engineAvailability('web', settings({ apiKey: 'sk-x' }))
    const siliconflow = list.find((e) => e.id === 'siliconflow')
    const wails = list.find((e) => e.id === 'wails')
    expect(siliconflow).toMatchObject({ ready: true, supported: true })
    expect(wails).toMatchObject({ ready: false, supported: false, reason: 'desktop-only' })
  })
})

describe('resolveEngine', () => {
  it('auto on web without key falls back to mock with reason', () => {
    const resolved = resolveEngine('web', settings())
    expect(resolved.id).toBe('mock')
    expect(resolved.fallbackReason).not.toBe('')
  })

  it('auto on web with key picks siliconflow', () => {
    const resolved = resolveEngine('web', settings({ apiKey: 'sk-x' }))
    expect(resolved.id).toBe('siliconflow')
    expect(resolved.fallbackReason).toBe('')
  })

  it('auto on desktop with key picks the wails engine', () => {
    const resolved = resolveEngine('wails', settings({ apiKey: 'sk-x' }))
    expect(resolved.id).toBe('wails')
  })

  it('explicit wails on web degrades to mock with a reason', () => {
    const resolved = resolveEngine('web', settings({ engine: 'wails', apiKey: 'sk-x' }))
    expect(resolved.id).toBe('mock')
    expect(resolved.fallbackReason).not.toBe('')
  })

  it('explicit mock always resolves to mock without reason', () => {
    const resolved = resolveEngine('web', settings({ engine: 'mock' }))
    expect(resolved.id).toBe('mock')
    expect(resolved.fallbackReason).toBe('')
  })

  it('explicit whisper-local resolves to the local engine on any platform', () => {
    for (const platform of ['web', 'wails'] as const) {
      const resolved = resolveEngine(platform, settings({ engine: 'whisper-local' }))
      expect(resolved.id).toBe('whisper-local')
      expect(resolved.fallbackReason).toBe('')
    }
  })

  it('auto never picks whisper-local (model download must be explicit)', () => {
    expect(resolveEngine('web', settings({ apiKey: 'sk-x' })).id).toBe('siliconflow')
    expect(resolveEngine('web', settings()).id).toBe('mock')
  })
})
