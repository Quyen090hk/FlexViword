import type { EngineId } from './domain'

export type ThemeMode = 'dark' | 'light'

export type LocaleCode = 'zh-CN' | 'en-US'

/** 本地 Whisper 模型档位（权重经浏览器缓存，二次使用免下载） */
export type LocalWhisperModel =
  'Xenova/whisper-tiny' | 'Xenova/whisper-base' | 'Xenova/whisper-small'

/** 本地识别语言；auto 交给 Whisper 自动检测 */
export type LocalLanguage = 'auto' | 'zh' | 'en'

export interface TranscriptionSettings {
  /** auto = 按平台与可用性自动选择 */
  engine: EngineId | 'auto'
  apiKey: string
  baseUrl: string
  model: string
  /** 本地 Whisper 模型档位 */
  localModel: LocalWhisperModel
  /** 本地识别语言 */
  localLanguage: LocalLanguage
  theme: ThemeMode
  locale: LocaleCode
  /** 播放时字幕列表自动跟随高亮滚动 */
  autoScrollTranscript: boolean
  /** 播放时把当前句叠加渲染到视频画面内（省去外挂播放器环节） */
  subtitleOverlay: boolean
}

export const DEFAULT_BASE_URL = '/api/siliconflow/v1/audio/transcriptions'
export const DEFAULT_MODEL = 'FunAudioLLM/SenseVoiceSmall'
export const DEFAULT_LOCAL_MODEL: LocalWhisperModel = 'Xenova/whisper-tiny'

export const LOCAL_MODEL_OPTIONS: Array<{ id: LocalWhisperModel; label: string; size: string }> = [
  { id: 'Xenova/whisper-tiny', label: 'Whisper Tiny', size: '~40MB' },
  { id: 'Xenova/whisper-base', label: 'Whisper Base', size: '~80MB' },
  { id: 'Xenova/whisper-small', label: 'Whisper Small', size: '~250MB' },
]

export const DEFAULT_SETTINGS: TranscriptionSettings = {
  engine: 'auto',
  apiKey: '',
  baseUrl: DEFAULT_BASE_URL,
  model: DEFAULT_MODEL,
  localModel: DEFAULT_LOCAL_MODEL,
  localLanguage: 'auto',
  theme: 'dark',
  locale: 'zh-CN',
  autoScrollTranscript: true,
  subtitleOverlay: true,
}
