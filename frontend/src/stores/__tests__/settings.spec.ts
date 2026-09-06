import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useSettingsStore } from '../settings'
import { loadJson, saveJson } from '@/services/storage'
import { DEFAULT_SETTINGS } from '@/types/settings'

describe('settings store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('starts with defaults', () => {
    const store = useSettingsStore()
    expect(store.settings).toMatchObject({
      engine: DEFAULT_SETTINGS.engine,
      theme: DEFAULT_SETTINGS.theme,
      locale: DEFAULT_SETTINGS.locale,
    })
  })

  it('persists updates to localStorage', async () => {
    const store = useSettingsStore()
    store.update({ theme: 'light', apiKey: 'sk-test' })
    await nextTick() // watch 回调在调度器上异步执行
    const persisted = loadJson<typeof store.settings>('settings')
    expect(persisted?.theme).toBe('light')
    expect(persisted?.apiKey).toBe('sk-test')
  })

  it('sanitizes corrupted persisted values', () => {
    saveJson('settings', { engine: 'not-an-engine', theme: 'solarized', apiKey: 42 })
    setActivePinia(createPinia())
    const store = useSettingsStore()
    expect(store.settings.engine).toBe(DEFAULT_SETTINGS.engine)
    expect(store.settings.theme).toBe(DEFAULT_SETTINGS.theme)
    // 非字符串 apiKey 被丢弃
    expect(store.settings.apiKey).toBe(DEFAULT_SETTINGS.apiKey)
  })

  it('sanitizes local model / language values', () => {
    saveJson('settings', {
      localModel: 'Xenova/evil-model',
      localLanguage: 'klingon',
      engine: 'whisper-local',
    })
    setActivePinia(createPinia())
    const store = useSettingsStore()
    expect(store.settings.localModel).toBe(DEFAULT_SETTINGS.localModel)
    expect(store.settings.localLanguage).toBe(DEFAULT_SETTINGS.localLanguage)
    // engine 本身是合法枚举值，应保留
    expect(store.settings.engine).toBe('whisper-local')
  })
})
