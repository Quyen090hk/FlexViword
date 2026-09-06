/** 引擎错误的统一封装：UI 层按 code 做 i18n 映射，避免把原始异常直接暴露给用户 */
export type EngineErrorCode =
  | 'NO_FILE'
  | 'NO_API_KEY'
  | 'EXTRACT_FAILED'
  | 'REQUEST_FAILED'
  | 'API_ERROR'
  | 'EMPTY_RESULT'
  | 'UNSUPPORTED_PLATFORM'
  | 'LOCAL_MODEL'
  | 'AUDIO_DECODE'

export class EngineError extends Error {
  readonly code: EngineErrorCode
  constructor(code: EngineErrorCode, message?: string, options?: { cause?: unknown }) {
    super(message ?? code)
    this.name = 'EngineError'
    this.code = code
    if (options && typeof options === 'object' && 'cause' in options) {
      ;(this as { cause?: unknown }).cause = options.cause
    }
  }
}
