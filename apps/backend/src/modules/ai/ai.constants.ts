import { JobsOptions } from 'bullmq'

/** One queue for the text-model tasks: feedback analysis and story drafting. */
export const AI_TASK_QUEUE = 'ai-tasks'

export type AiTaskKind = 'feedback-analysis' | 'story-generation'

/**
 * What a queued job carries: only the kind and the database row id. Project,
 * round, requester and every input are read from the row by the worker, so a
 * job can never name resources of its own.
 */
export interface AiTaskJobData {
  kind: AiTaskKind
  id: string
}

export interface AiProgress {
  stage:
    'started' | 'loading' | 'analysing' | 'drafting' | 'validating' | 'saving'
  /** Characters of model output received so far. */
  receivedChars?: number
  message?: string
}

/** A task that runs longer than this is aborted and retried. */
export const AI_TASK_TIMEOUT_MS = 10 * 60 * 1000

/**
 * Transient failures (LLM timeouts, network, 5xx, a malformed answer) are
 * retried with backoff; the database row records the outcome.
 */
export const AI_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 10_000 },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
}
