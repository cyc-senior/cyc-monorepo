/** The request was cancelled through its AbortSignal. */
export class LlmAbortedError extends Error {
  constructor() {
    super('Cancelled.')
  }
}
