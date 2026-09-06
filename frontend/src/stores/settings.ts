import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { TranscriptionSettings } from '@/types/settings'
import { DEFAULT_SETTINGS } from '@/types/settings'
import { loadJson, saveJson } from '@/services/storage'
import { setLocale } from '@/i18n'

/** 主题应用：CSS 变量走 data-theme 切换，避免整页重载 */
function applySideEffects(settings: TranscriptionSettings): void {
  document.documentElement.dataset.theme = settings.theme
  setLocale(settings.locale)
}

function isEngineValue(value: unknown): boolean {
  return ['auto', 'mock', 'siliconflow', 'wails', 'whisper-local'].includes(value as string)
}

const LOCAL_MODELS = ['Xenova/whisper-tiny', 'Xenova/whisper-base', 'Xenova/whisper-small']
const LOCAL_LANGUAGES = ['auto', 'zh', 'en']

export const useSettingsStore = defineStore('settings', () => {
  // 合并已持久化的设置并做基本校验，防止旧数据/手改数据导致运行异常
  const stored = loadJson<Partial<TranscriptionSettings>>('settings')
  const safe: Partial<TranscriptionSettings> = {}
  if (stored) {
    if (isEngineValue(stored.engine)) safe.engine = stored.engine
    if (stored.theme === 'dark' || stored.theme === 'light') safe.theme = stored.theme
    if (stored.locale === 'zh-CN' || stored.locale === 'en-US') safe.locale = stored.locale
    if (typeof stored.apiKey === 'string') safe.apiKey = stored.apiKey
    if (typeof stored.baseUrl === 'string' && stored.baseUrl) safe.baseUrl = stored.baseUrl
    if (typeof stored.model === 'string' && stored.model) safe.model = stored.model
    if (typeof stored.localModel === 'string' && LOCAL_MODELS.includes(stored.localModel))
      safe.localModel = stored.localModel as TranscriptionSettings['localModel']
    if (typeof stored.localLanguage === 'string' && LOCAL_LANGUAGES.includes(stored.localLanguage))
      safe.localLanguage = stored.localLanguage as TranscriptionSettings['localLanguage']
    if (typeof stored.autoScrollTranscript === 'boolean')
      safe.autoScrollTranscript = stored.autoScrollTranscript
  }

  const settings = ref<TranscriptionSettings>({ ...DEFAULT_SETTINGS, ...safe })

  function update(patch: Partial<TranscriptionSettings>): void {
    settings.value = { ...settings.value, ...patch }
  }

  watch(
    settings,
    (value) => {
      saveJson('settings', value)
      applySideEffects(value)
    },
    { deep: true },
  )

  applySideEffects(settings.value)

  return { settings, update }
})
