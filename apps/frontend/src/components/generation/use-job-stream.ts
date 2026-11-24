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

export interface VariantTraceItem {
  id: string;
  phase: VariantTracePhase;
  status: "running" | "done" | "error";
  title: string;
  thought?: string;
  receivedChars?: number;
  errors?: number;
  attempt?: number;
}

export interface JobStreamState {
  snapshot: JobSnapshot | null;
  progress: GenerationProgress | null;
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
      const items = next[v].map((item) =>
        item.status === "running" ? { ...item, status: "done" as const } : item
      );
      if (!items.some((i) => i.phase === "ready")) {
        items.push({
          id: "ready",
          phase: "ready",
          status: "done",
          title: "Variant markup verified & saved",
        });
      }
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
        title: "Analyzing UX strategy & persona goals",
        thought: progress.thought,
      });
    }
  } else if (progress.stage === "generating") {
    // Thinking is done if it was running
    for (let i = 0; i < currentItems.length; i++) {
      if (
        currentItems[i].phase === "thinking" &&
        currentItems[i].status === "running"
      ) {
        currentItems[i] = { ...currentItems[i], status: "done" };
      }
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
        currentItems[i] = { ...currentItems[i], status: "done" };
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
        errors: progress.errors,
      };
    } else {
      currentItems.push({
        id: repairId,
        phase: "repairing",
        status: "running",
        title: `Auto-adjusting contrast & element slots (Attempt ${progress.attempt ?? 2})`,
        errors: progress.errors,
        attempt: progress.attempt,
      });
    }
  } else if (progress.stage === "saving") {
    // All done for all variants
    for (const v in next) {
      next[v] = next[v].map((item) =>
        item.status === "running" ? { ...item, status: "done" as const } : item
      );
      if (!next[v].some((i) => i.phase === "ready")) {
        next[v].push({
          id: "ready",
          phase: "ready",
          status: "done",
          title: "Variant markup verified & saved",
        });
      }
    }
    return next;
  }

  next[currentVariant] = currentItems;
  return next;
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
    { jobId: null, ...EMPTY }
  );

  useEffect(() => {
    if (!jobId) return;
    const abort = new AbortController();

    followJobEvents(
      projectId,
      jobId,
      (event) =>
        setState((prev) => {
          const base = prev.jobId === jobId ? prev : { jobId, ...EMPTY };
          if (event.type === "progress") {
            const nextThoughts =
              event.data.variant && event.data.thought
                ? {
                    ...base.thoughtsByVariant,
                    [event.data.variant]: event.data.thought,
                  }
                : base.thoughtsByVariant;

            const nextTraces = updateTraces(base.tracesByVariant, event.data);

            return {
              ...base,
              progress: event.data,
              thoughtsByVariant: nextThoughts,
              tracesByVariant: nextTraces,
              streamError: null,
            };
          }

          if (event.data.status === "SUCCEEDED") {
            const finishedTraces: Record<number, VariantTraceItem[]> = {
              ...base.tracesByVariant,
            };
            for (const v in finishedTraces) {
              finishedTraces[v] = finishedTraces[v].map((item) =>
                item.status === "running"
                  ? { ...item, status: "done" as const }
                  : item
              );
              if (!finishedTraces[v].some((i) => i.phase === "ready")) {
                finishedTraces[v].push({
                  id: "ready",
                  phase: "ready",
                  status: "done",
                  title: "Variant markup verified & saved",
                });
              }
            }
            return {
              ...base,
              snapshot: event.data,
              tracesByVariant: finishedTraces,
              streamError: null,
            };
          }

          return { ...base, snapshot: event.data, streamError: null };
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
