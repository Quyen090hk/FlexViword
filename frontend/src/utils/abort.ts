/** 与 AbortSignal 协作的异步工具：可取消的 sleep / 统一的取消异常 */

export function isAborted(signal?: AbortSignal): boolean {
  return signal?.aborted ?? false
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (isAborted(signal)) throw abortError()
}

/** 规范的取消异常（与 fetch 被 abort 时的行为一致） */
export function abortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError')
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isAborted(signal)) {
      reject(abortError())
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    function onAbort() {
      clearTimeout(timer)
      reject(abortError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/** 把外部 signal 转换成 AbortController：组合多个取消来源时使用 */
export function linkSignal(signal?: AbortSignal): {
  controller: AbortController
  dispose: () => void
} {
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', onAbort, { once: true })
  }
  return { controller, dispose: () => signal?.removeEventListener('abort', onAbort) }
}
