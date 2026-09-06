import { ref } from 'vue'
import type { LocaleCode } from '@/types/settings'
import { zhCN } from './zh-CN'
import { enUS } from './en-US'

/**
 * 手写的微型 i18n：~40 行实现，避免为一个翻译函数引入完整 vue-i18n。
 * - 嵌套 key 通过 dot-path 查找；
 * - 当前语言缺失时回退中文，再缺失回退 key 本身；
 * - {name} 形式的插值参数。
 * 够用的扩展空间：复数、日期格式化（后续可平滑替换为 vue-i18n）。
 */

const dictionaries = { 'zh-CN': zhCN, 'en-US': enUS } as const

const locale = ref<LocaleCode>('zh-CN')

function resolve(dict: unknown, path: string): string | undefined {
  let node: unknown = dict
  for (const part of path.split('.')) {
    if (node === null || typeof node !== 'object') return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string' ? node : undefined
}

function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in params ? String(params[key]) : `{${key}}`,
  )
}

export function t(path: string, params?: Record<string, string | number>): string {
  const value = resolve(dictionaries[locale.value], path) ?? resolve(zhCN, path) ?? path
  return params ? interpolate(value, params) : value
}

export function setLocale(next: LocaleCode): void {
  locale.value = next
}

export function getLocale(): LocaleCode {
  return locale.value
}

export function useI18n() {
  return { t, locale, setLocale }
}
