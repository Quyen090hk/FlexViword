/** 生成短随机 id，优先使用 crypto.randomUUID */
export function uid(prefix = ''): string {
  const core =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
  return prefix ? `${prefix}_${core}` : core
}
