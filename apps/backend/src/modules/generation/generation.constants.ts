import { JobsOptions } from 'bullmq'

export const DESIGN_GENERATION_QUEUE = 'design-generation'
export const PROMPT_DRAFT_QUEUE = 'prompt-draft'

/** What a queued prompt-drafting job carries. */
export interface PromptDraftJobData {
  projectId: string
  storyId: string
  personaId?: string
}

/** Progress a worker reports while drafting a structured prompt (relayed over SSE). */
export interface PromptDraftProgress {
  status: string
  stage: 'loading_inputs' | 'drafting' | 'llm_streaming'
  thought?: string
  thoughtChars?: number
  charsReceived?: number
  thoughtDurationSeconds?: number
}

export const PROMPT_DRAFT_JOB_OPTIONS: JobsOptions = {
  attempts: 2,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { age: 3600, count: 500 },
  removeOnFail: { age: 3600, count: 500 },
}

export function promptDraftJobId(storyId: string): string {
  return `draft-${storyId}`
}

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
  /** Total characters of reasoning received so far in this attempt. */
  thoughtChars?: number
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
