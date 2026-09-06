/** localStorage 的安全封装：隐私模式/配额异常时静默退化为内存 Map */

const PREFIX = 'fv:'

const memoryStore = new Map<string, string>()

function storage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  try {
    const probe = `${PREFIX}__probe__`
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return localStorage
  } catch {
    return {
      getItem: (k) => memoryStore.get(k) ?? null,
      setItem: (k, v) => void memoryStore.set(k, v),
      removeItem: (k) => void memoryStore.delete(k),
    }
  }
}

export function loadJson<T>(key: string): T | undefined {
  try {
    const raw = storage().getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : undefined
  } catch {
    return undefined
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    storage().setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* 配额满等异常：设置类小数据几乎不会发生，忽略即可 */
  }
}

export function removeKey(key: string): void {
  storage().removeItem(PREFIX + key)
}
