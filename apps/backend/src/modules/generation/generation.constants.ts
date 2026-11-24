import { JobsOptions } from 'bullmq'

export const DESIGN_GENERATION_QUEUE = 'design-generation'

/** What a queued job carries; everything else is read from the database. */
export interface DesignGenerationJobData {
  generationJobId: string
}

/** Progress a worker reports while generating (relayed over SSE). */
export interface GenerationProgress {
  stage:
    | 'started'
    | 'persona'
    | 'thinking'
    | 'generating'
    | 'checking'
    | 'repairing'
    | 'saving'
  /** 1-based variant being worked on, and how many the job makes. */
  variant?: number
  of: number
  /** 1 = first try, then each repair. */
  attempt?: number
  /** Characters of model output received so far in this attempt. */
  receivedChars?: number
  /** The latest part of the model's live reasoning (see {@link thoughtTail}). */
  thought?: string
  /** Errors found by the last check. */
  errors?: number
  message?: string
}

/**
 * Transient failures (LLM timeouts, network, 5xx) are retried with backoff;
 * designs that cannot pass the checks fail for good (`UnrecoverableError`).
 * A retry reuses the persona artifact an earlier attempt saved.
 * Finished jobs are trimmed from Redis; the database keeps the record.
 */
export const DESIGN_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 15_000 },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
}

/** Live reasoning relayed per progress event: the latest characters only. */
export const LIVE_THOUGHT_CHARS = 4_000
/** Reasoning kept per design in a job's `outputMetadata`. */
export const STORED_THOUGHT_CHARS = 8_000

/**
 * The end of a model's reasoning, at most `max` characters (marked with a
 * leading "…" when cut). Reasoning grows with every token; resending or
 * storing all of it makes each progress event and job row ever larger.
 */
export function thoughtTail(
  thought: string | undefined,
  max: number = LIVE_THOUGHT_CHARS,
): string | undefined {
  if (!thought) {
    return undefined
  }
  return thought.length <= max ? thought : `…${thought.slice(-(max - 1))}`
}
