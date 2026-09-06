import { describe, expect, it } from 'vitest'
import { getLocale, setLocale, t } from '../index'

describe('i18n', () => {
  it('resolves nested keys in the active locale', () => {
    setLocale('zh-CN')
    expect(t('nav.workspace')).toBe('工作台')
    setLocale('en-US')
    expect(t('nav.workspace')).toBe('Workspace')
    setLocale('zh-CN')
  })

  it('interpolates params', () => {
    expect(t('workspace.queuedCount', { count: 3 })).toContain('3')
  })

  it('falls back to zh-CN then to the key itself', () => {
    setLocale('en-US')
    expect(t('nonexistent.key')).toBe('nonexistent.key')
    setLocale('zh-CN')
    expect(getLocale()).toBe('zh-CN')
  })
})
