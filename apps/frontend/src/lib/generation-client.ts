import { API_URL, apiFetch } from "@/lib/api-client";
import { fetchSse, readSseStream } from "@/lib/sse";

/** Backend generation job lifecycle. */
export type GenerationJobStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED";

export type GenerationStage =
  | "started"
  | "persona"
  | "thinking"
  | "generating"
  | "checking"
  | "repairing"
  | "saving";

/** Live progress sent over SSE while a job runs. */
export interface GenerationProgress {
  stage: GenerationStage;
  /** 1-based variant being worked on. */
  variant?: number;
  of: number;
  attempt?: number;
  receivedChars?: number;
  /** Live reasoning or thinking text emitted by the model. */
  thought?: string;
  /** Errors found by the last check. */
  errors?: number;
}

/** What the prompt template used; only the fields the UI reads. */
export interface GenerationInputSnapshot {
  prompt?: string;
  synthesizePersona?: boolean;
  intent?: {
    designSystem?: string;
    designStandards?: string[];
  };
  stories?: Array<{ id: string; title: string }>;
}

export interface GenerationOutputVariant {
  variant: number;
  passed: boolean;
  attempts: number;
  title?: string;
  rationale?: string;
  thought?: string;
  issues?: Array<{ message: string; criterion?: string }>;
}

export interface GenerationJob {
  id: string;
  roundId: string;
  status: GenerationJobStatus;
  prompt: string | null;
  baseVariantId: string | null;
  variantCount: number;
  uiLibrary: string;
  inputSnapshot: GenerationInputSnapshot | null;
  outputMetadata: {
    variants?: GenerationOutputVariant[];
    personaThought?: string;
  } | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  variantIds: string[];
  createdAt: string;
}

export interface UIVariant {
  id: string;
  roundId: string;
  generationJobId: string | null;
  parentVariantId: string | null;
  name: string;
  label: string | null;
  status: "DRAFT" | "READY" | "APPROVED" | "ARCHIVED";
  /** Sanitized, script-free HTML document. */
  html: string | null;
  storyIds: string[];
  createdAt: string;
}

interface Page<T> {
  data: T[];
  total: number;
}

const MAX_PAGE = 100;

export function getGenerationJob(
  projectId: string,
  jobId: string
): Promise<GenerationJob> {
  return apiFetch<GenerationJob>(
    `/projects/${projectId}/generation-jobs/${jobId}`
  );
}

/** Jobs of a round, oldest first. */
export async function listRoundJobs(
  projectId: string,
  roundId: string
): Promise<GenerationJob[]> {
  const page = await apiFetch<Page<GenerationJob>>(
    `/projects/${projectId}/rounds/${roundId}/generation-jobs`,
    { params: { limit: MAX_PAGE } }
  );
  return [...page.data].reverse();
}

/** Variants of a round, oldest first. */
export async function listRoundVariants(
  projectId: string,
  roundId: string
): Promise<UIVariant[]> {
  const page = await apiFetch<Page<UIVariant>>(
    `/projects/${projectId}/rounds/${roundId}/variants`,
    { params: { limit: MAX_PAGE } }
  );
  return page.data;
}

export function getVariant(
  projectId: string,
  variantId: string
): Promise<UIVariant> {
  return apiFetch<UIVariant>(`/projects/${projectId}/variants/${variantId}`);
}

export function cancelGenerationJob(
  projectId: string,
  jobId: string
): Promise<GenerationJob> {
  return apiFetch<GenerationJob>(
    `/projects/${projectId}/generation-jobs/${jobId}/cancel`,
    { method: "POST", data: {} }
  );
}

export interface RefineRequest {
  prompt: string;
  baseVariantId: string;
  storyIds?: string[];
}

/** Asks for one new version of `baseVariantId`. */
export function startRefinement(
  projectId: string,
  roundId: string,
  request: RefineRequest
): Promise<GenerationJob> {
  return apiFetch<GenerationJob>(
    `/projects/${projectId}/rounds/${roundId}/generation-jobs`,
    {
      method: "POST",
      data: {
        ...request,
        variantCount: 1,
        synthesizePersona: false,
        idempotencyKey: crypto.randomUUID(),
      },
    }
  );
}

/** New designs (not refinements) in a round, e.g. a design that failed its checks. */
export function generateMore(
  projectId: string,
  roundId: string,
  request: { prompt: string; variantCount: number; storyIds?: string[] }
): Promise<GenerationJob> {
  return apiFetch<GenerationJob>(
    `/projects/${projectId}/rounds/${roundId}/generation-jobs`,
    {
      method: "POST",
      data: { ...request, synthesizePersona: false, idempotencyKey: crypto.randomUUID() },
    }
  );
}

/** Retries a failed job with the same prompt and stories. */
export function retryGeneration(
  projectId: string,
  job: GenerationJob
): Promise<GenerationJob> {
  return apiFetch<GenerationJob>(
    `/projects/${projectId}/rounds/${job.roundId}/generation-jobs`,
    {
      method: "POST",
      data: {
        prompt: job.prompt ?? job.inputSnapshot?.prompt ?? "",
        variantCount: job.variantCount,
        storyIds: job.inputSnapshot?.stories?.map((s) => s.id),
        baseVariantId: job.baseVariantId ?? undefined,
        idempotencyKey: crypto.randomUUID(),
      },
    }
  );
}

/** Restoring saves the old design as a new version on top of `current`. */
export function restoreVariant(
  projectId: string,
  old: UIVariant,
  current: UIVariant
): Promise<UIVariant> {
  return apiFetch<UIVariant>(
    `/projects/${projectId}/rounds/${old.roundId}/variants`,
    {
      method: "POST",
      data: {
        name: old.name,
        label: old.label,
        html: old.html,
        storyIds: old.storyIds,
        status: "READY",
        parentVariantId: current.id,
      },
    }
  );
}

export function approveVariant(
  projectId: string,
  variantId: string
): Promise<UIVariant> {
  return apiFetch<UIVariant>(
    `/projects/${projectId}/variants/${variantId}/approve`,
    { method: "POST", data: { rationale: "Ready to test" } }
  );
}

/** One parsed server-sent event of a job stream. */
export type JobEvent =
  | { type: "status" | "completed" | "failed" | "cancelled"; data: JobSnapshot }
  | { type: "progress"; data: GenerationProgress };

export interface JobSnapshot {
  jobId: string;
  status: GenerationJobStatus;
  error: string | null;
  variantIds: string[];
}

const FINAL_EVENTS = new Set(["completed", "failed", "cancelled"]);
const RECONNECT_MS = 3_000;

/**
 * Follows `GET .../generation-jobs/{jobId}/events`. The browser's EventSource
 * cannot send the bearer token, so the stream is read with fetch. Dropped
 * connections are resumed (the server always starts with the current state);
 * it stops after a final event or when `signal` aborts.
 */
export async function followJobEvents(
  projectId: string,
  jobId: string,
  onEvent: (event: JobEvent) => void,
  signal: AbortSignal
): Promise<void> {
  const url = `${API_URL}/projects/${projectId}/generation-jobs/${jobId}/events`;

  while (!signal.aborted) {
    let finished = false;
    try {
      const res = await fetchSse(url, signal);
      if (res.status >= 400 && res.status < 410) {
        // Bad request, still unauthorized, forbidden, not found: retrying
        // will not help. (Rate limits and server errors reconnect.)
        throw new JobStreamError(res.status);
      }
      if (!res.ok || !res.body) {
        throw new Error(`Event stream failed (${res.status})`);
      }
      await readSseStream(res.body, (event) => {
        if (typeof event.data !== "object" || event.data === null) return;
        onEvent(event as JobEvent);
        if (FINAL_EVENTS.has(event.type)) finished = true;
      });
    } catch (error) {
      if (signal.aborted) return;
      if (error instanceof JobStreamError) throw error;
    }
    if (finished) return;
    await new Promise((resolve) => setTimeout(resolve, RECONNECT_MS));
  }
}

/** The job stream was refused (4xx); reconnecting will not help. */
export class JobStreamError extends Error {
  constructor(readonly status: number) {
    super(`Event stream failed (${status})`);
  }
}
