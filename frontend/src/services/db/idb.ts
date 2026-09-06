/** 极简 Promise 化 IndexedDB 封装：够用即可，不为引入 idb 而引入 idb */

const DB_NAME = 'flexviword'
const DB_VERSION = 1

export const STORE_TASKS = 'tasks'
export const STORE_FILES = 'files'

let dbPromise: Promise<IDBDatabase> | null = null

function openDatabase(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_TASKS)) {
        db.createObjectStore(STORE_TASKS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES) // keyPath 缺省，显式用 taskId 作 key
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
  })
  return dbPromise
}

function toPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}
void toPromise

export async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T> {
  const db = await openDatabase()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const store = tx.objectStore(storeName)
    const request = fn(store)
    let result: T | undefined
    if (request) {
      request.onsuccess = () => {
        result = request.result
      }
    }
    tx.oncomplete = () => resolve(result as T)
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })
}

export async function idbGet<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  return withStore<T | undefined>(store, 'readonly', (s) => s.get(key))
}

export async function idbGetAll<T>(store: string): Promise<T[]> {
  return withStore<T[]>(store, 'readonly', (s) => s.getAll())
}

export async function idbPut(store: string, value: unknown, key?: IDBValidKey): Promise<void> {
  await withStore(store, 'readwrite', (s) => (key === undefined ? s.put(value) : s.put(value, key)))
}

export async function idbDelete(store: string, key: IDBValidKey): Promise<void> {
  await withStore(store, 'readwrite', (s) => s.delete(key))
}

export async function idbClear(store: string): Promise<void> {
  await withStore(store, 'readwrite', (s) => s.clear())
}

export async function idbAvailable(): Promise<boolean> {
  try {
    await openDatabase()
    return true
  } catch {
    return false
  }
}
