import { AsyncLocalStorage } from 'node:async_hooks'

interface RequestContext {
  requestId: string
}

const storage = new AsyncLocalStorage<RequestContext>()

/** Runs `fn` with `requestId` visible to every log line it produces. */
export function runWithRequestId<T>(requestId: string, fn: () => T): T {
  return storage.run({ requestId }, fn)
}

/** The id of the HTTP request being handled, if any. */
export function currentRequestId(): string | undefined {
  return storage.getStore()?.requestId
}
