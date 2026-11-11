export class LlmNotConfiguredError extends Error {
  constructor() {
    super('Design generation is not configured (LLM_BASE_URL / LLM_API_KEY).')
  }
}
