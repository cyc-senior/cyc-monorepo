"use client";

import { useEffect, useState } from "react";
import {
  followJobEvents,
  GenerationProgress,
  JobSnapshot,
} from "@/lib/generation-client";

export type VariantTracePhase =
  | "thinking"
  | "generating"
  | "checking"
  | "repairing"
  | "ready";

export const PHASE_ORDER: Record<VariantTracePhase, number> = {
  thinking: 0,
  generating: 1,
  checking: 2,
  repairing: 3,
  ready: 4,
};

export interface VariantTraceItem {
  id: string;
  phase: VariantTracePhase;
  status: "running" | "done" | "error";
  title: string;
  thought?: string;
  thoughtDurationSeconds?: number;
  startedAt?: number;
  endedAt?: number;
  receivedChars?: number;
  errors?: number;
  attempt?: number;
}

export interface JobStreamState {
  snapshot: JobSnapshot | null;
  progress: GenerationProgress | null;
  /** Live thought emitted during persona synthesis */
  personaThought: string | null;
  /** Accumulated thoughts by variant index (1-based). */
  thoughtsByVariant: Record<number, string>;
  /** Stacked traces by variant index (1-based). */
  tracesByVariant: Record<number, VariantTraceItem[]>;
  /** The stream itself could not be read (not a failed job). */
  streamError: string | null;
}

const EMPTY: JobStreamState = {
  snapshot: null,
  progress: null,
  personaThought: null,
  thoughtsByVariant: {},
  tracesByVariant: {},
  streamError: null,
};

function updateTraces(
  prevTraces: Record<number, VariantTraceItem[]>,
  progress: GenerationProgress
): Record<number, VariantTraceItem[]> {
  const currentVariant = progress.variant;
  if (!currentVariant) return prevTraces;

  const next: Record<number, VariantTraceItem[]> = { ...prevTraces };

  // For any variant prior to currentVariant, mark all items done and ensure "ready" exists
  for (let v = 1; v < currentVariant; v++) {
    if (next[v]) {
      const items = next[v].map((item) => {
        if (item.status === "running") {
          if (item.phase === "thinking" || item.phase === "repairing") {
            const start = item.startedAt ?? Date.now() - 5000;
            const dur = Math.max(1, Math.round((Date.now() - start) / 1000));
            return {
              ...item,
              status: "done" as const,
              thoughtDurationSeconds: dur,
              title: item.phase === "thinking"
                ? `Thought for ${dur} seconds`
                : item.title,
            };
          }
          return { ...item, status: "done" as const };
        }
        return item;
      });
      if (!items.some((i) => i.phase === "ready")) {
        items.push({
          id: "ready",
          phase: "ready",
          status: "done",
          title: "Variant markup verified & saved",
        });
      }
      items.sort(
        (a, b) => (PHASE_ORDER[a.phase] ?? 99) - (PHASE_ORDER[b.phase] ?? 99)
      );
      next[v] = items;
    }
  }

  // Update current variant
  const currentItems = [...(next[currentVariant] ?? [])];

  if (progress.stage === "thinking") {
    const existingIdx = currentItems.findIndex((i) => i.id === "thinking");
    if (existingIdx >= 0) {
      currentItems[existingIdx] = {
        ...currentItems[existingIdx],
        thought: progress.thought ?? currentItems[existingIdx].thought,
      };
    } else {
      currentItems.push({
        id: "thinking",
        phase: "thinking",
        status: "running",
        title: "Thinking...",
        thought: progress.thought,
        startedAt: Date.now(),
      });
    }
  } else if (progress.stage === "generating") {
    // If thinking was running, finish it and calculate duration
    for (let i = 0; i < currentItems.length; i++) {
      if (
        currentItems[i].phase === "thinking" &&
        currentItems[i].status === "running"
      ) {
        const start = currentItems[i].startedAt ?? Date.now() - 4000;
        const dur = Math.max(1, Math.round((Date.now() - start) / 1000));
        currentItems[i] = {
          ...currentItems[i],
          status: "done",
          thoughtDurationSeconds: dur,
          title: `Thought for ${dur} seconds`,
        };
      }
    }

    // If thinking wasn't captured yet but we have thoughts, backfill thinking item
    if (
      !currentItems.some((i) => i.phase === "thinking") &&
      progress.thought
    ) {
      currentItems.unshift({
        id: "thinking",
        phase: "thinking",
        status: "done",
        title: "Thought for 5 seconds",
        thoughtDurationSeconds: 5,
        thought: progress.thought,
      });
    }

    const existingIdx = currentItems.findIndex((i) => i.id === "generating");
    if (existingIdx >= 0) {
      currentItems[existingIdx] = {
        ...currentItems[existingIdx],
        receivedChars:
          progress.receivedChars ?? currentItems[existingIdx].receivedChars,
      };
    } else {
      currentItems.push({
        id: "generating",
        phase: "generating",
        status: "running",
        title: "Drafting HTML component hierarchy",
        receivedChars: progress.receivedChars,
      });
    }
  } else if (progress.stage === "checking") {
    // Generating is done
    for (let i = 0; i < currentItems.length; i++) {
      if (
        currentItems[i].phase === "generating" &&
        currentItems[i].status === "running"
      ) {
        const chars = currentItems[i].receivedChars;
        currentItems[i] = {
          ...currentItems[i],
          status: "done",
          title: chars
            ? `Drafted HTML component hierarchy (${(chars / 1024).toFixed(1)} KB)`
            : "Drafted HTML component hierarchy",
        };
      }
      if (
        currentItems[i].phase === "repairing" &&
        currentItems[i].status === "running"
      ) {
        const start = currentItems[i].startedAt ?? Date.now() - 3000;
        const dur = Math.max(1, Math.round((Date.now() - start) / 1000));
        currentItems[i] = {
          ...currentItems[i],
          status: "done",
          thoughtDurationSeconds: dur,
        };
      }
    }
    const existingIdx = currentItems.findIndex((i) => i.id === "checking");
    const hasErrors = progress.errors !== undefined && progress.errors > 0;
    if (existingIdx >= 0) {
      currentItems[existingIdx] = {
        ...currentItems[existingIdx],
        status: hasErrors ? "error" : "running",
        errors: progress.errors,
      };
    } else {
      currentItems.push({
        id: "checking",
        phase: "checking",
        status: hasErrors ? "error" : "running",
        title: "Validating WCAG 2.2 AA contrast & design system rules",
        errors: progress.errors,
      });
    }
  } else if (progress.stage === "repairing") {
    // Checking has error
    for (let i = 0; i < currentItems.length; i++) {
      if (currentItems[i].phase === "checking") {
        currentItems[i] = { ...currentItems[i], status: "error" };
      }
    }
    const repairId = `repairing-${progress.attempt ?? 2}`;
    const existingIdx = currentItems.findIndex((i) => i.id === repairId);
    if (existingIdx >= 0) {
      currentItems[existingIdx] = {
        ...currentItems[existingIdx],
        thought: progress.thought ?? currentItems[existingIdx].thought,
        errors: progress.errors ?? currentItems[existingIdx].errors,
      };
    } else {
      currentItems.push({
        id: repairId,
        phase: "repairing",
        status: "running",
        title: `Auto-adjusting contrast & element slots (Attempt ${progress.attempt ?? 2})`,
        thought: progress.thought,
        errors: progress.errors,
        attempt: progress.attempt,
        startedAt: Date.now(),
      });
    }
  } else if (progress.stage === "saving") {
    // All done for all variants
    for (const v in next) {
      next[v] = next[v].map((item) => {
        if (item.status === "running") {
          if (item.phase === "thinking" || item.phase === "repairing") {
            const start = item.startedAt ?? Date.now() - 5000;
            const dur = Math.max(1, Math.round((Date.now() - start) / 1000));
            return {
              ...item,
              status: "done" as const,
              thoughtDurationSeconds: dur,
              title: item.phase === "thinking"
                ? `Thought for ${dur} seconds`
                : item.title,
            };
          }
          if (item.phase === "generating") {
            const chars = item.receivedChars;
            return {
              ...item,
              status: "done" as const,
              title: chars
                ? `Drafted HTML component hierarchy (${(chars / 1024).toFixed(1)} KB)`
                : "Drafted HTML component hierarchy",
            };
          }
          if (item.phase === "checking") {
            return {
              ...item,
              status: "done" as const,
              title: "Validated WCAG 2.2 AA contrast & design system rules",
            };
          }
          return { ...item, status: "done" as const };
        }
        return item;
      });
      if (!next[v].some((i) => i.phase === "ready")) {
        next[v].push({
          id: "ready",
          phase: "ready",
          status: "done",
          title: "Variant markup verified & saved",
        });
      }
      next[v].sort(
        (a, b) => (PHASE_ORDER[a.phase] ?? 99) - (PHASE_ORDER[b.phase] ?? 99)
      );
    }
    return next;
  }

  currentItems.sort(
    (a, b) => (PHASE_ORDER[a.phase] ?? 99) - (PHASE_ORDER[b.phase] ?? 99)
  );
  next[currentVariant] = currentItems;
  return next;
}

function loadCachedState(jobId: string | null): Partial<JobStreamState> {
  if (!jobId || typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(`gen_trace:${jobId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveCachedState(jobId: string | null, state: JobStreamState) {
  if (!jobId || typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      `gen_trace:${jobId}`,
      JSON.stringify({
        tracesByVariant: state.tracesByVariant,
        thoughtsByVariant: state.thoughtsByVariant,
        personaThought: state.personaThought,
      })
    );
  } catch {}
}

/**
 * Live state of one generation job over SSE. Pass `null` to follow nothing.
 * The state is keyed by job, so switching jobs never shows the old one's.
 */
export function useJobStream(
  projectId: string,
  jobId: string | null
): JobStreamState {
  const [state, setState] = useState<{ jobId: string | null } & JobStreamState>(
    () => ({
      jobId,
      ...EMPTY,
      ...loadCachedState(jobId),
    })
  );

  useEffect(() => {
    if (!jobId) return;
    const abort = new AbortController();

    followJobEvents(
      projectId,
      jobId,
      (event) =>
        setState((prev) => {
          const cached = prev.jobId === jobId ? prev : { jobId, ...EMPTY, ...loadCachedState(jobId) };
          if (event.type === "progress") {
            const nextThoughts =
              event.data.variant && event.data.thought
                ? {
                    ...cached.thoughtsByVariant,
                    [event.data.variant]: event.data.thought,
                  }
                : cached.thoughtsByVariant;

            const personaThought =
              event.data.stage === "persona" && event.data.thought
                ? event.data.thought
                : cached.personaThought;

            const nextTraces = updateTraces(cached.tracesByVariant, event.data);

            const nextState = {
              ...cached,
              progress: event.data,
              personaThought,
              thoughtsByVariant: nextThoughts,
              tracesByVariant: nextTraces,
              streamError: null,
            };
            saveCachedState(jobId, nextState);
            return nextState;
          }

          if (event.data.status === "SUCCEEDED") {
            const finishedTraces: Record<number, VariantTraceItem[]> = {
              ...cached.tracesByVariant,
            };
            for (const v in finishedTraces) {
              finishedTraces[v] = finishedTraces[v].map((item) => {
                if (item.status === "running") {
                  if (item.phase === "thinking" || item.phase === "repairing") {
                    const dur = item.thoughtDurationSeconds ?? 5;
                    return {
                      ...item,
                      status: "done" as const,
                      thoughtDurationSeconds: dur,
                      title: item.phase === "thinking"
                        ? `Thought for ${dur} seconds`
                        : item.title,
                    };
                  }
                  return { ...item, status: "done" as const };
                }
                return item;
              });
              if (!finishedTraces[v].some((i) => i.phase === "ready")) {
                finishedTraces[v].push({
                  id: "ready",
                  phase: "ready",
                  status: "done",
                  title: "Variant markup verified & saved",
                });
              }
              finishedTraces[v].sort(
                (a, b) => (PHASE_ORDER[a.phase] ?? 99) - (PHASE_ORDER[b.phase] ?? 99)
              );
            }
            const nextState = {
              ...cached,
              snapshot: event.data,
              tracesByVariant: finishedTraces,
              streamError: null,
            };
            saveCachedState(jobId, nextState);
            return nextState;
          }

          return { ...cached, snapshot: event.data, streamError: null };
        }),
      abort.signal
    ).catch((error: unknown) =>
      setState({
        jobId,
        ...EMPTY,
        streamError:
          error instanceof Error ? error.message : "Lost the live status.",
      })
    );

    return () => abort.abort();
  }, [projectId, jobId]);

  return state.jobId === jobId ? state : EMPTY;
}
