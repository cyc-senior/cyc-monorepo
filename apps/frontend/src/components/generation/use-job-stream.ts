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
  thoughtTokens?: number;
  outputTokens?: number;
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

export function estimateTokens(chars?: number): number {
  if (!chars || chars <= 0) return 0;
  return Math.max(1, Math.round(chars / 4));
}

function finalizeThinkingItem(
  item: VariantTraceItem,
  thoughtChars?: number
): VariantTraceItem {
  const start = item.startedAt ?? Date.now() - 4000;
  const dur = item.thoughtDurationSeconds ?? Math.max(1, Math.round((Date.now() - start) / 1000));
  const tokens =
    item.thoughtTokens ??
    estimateTokens(thoughtChars ?? item.thought?.length);
  const tokenSuffix = tokens > 0 ? ` (${tokens.toLocaleString()} tokens)` : "";
  return {
    ...item,
    status: "done",
    endedAt: item.endedAt ?? Date.now(),
    thoughtDurationSeconds: dur,
    thoughtTokens: tokens > 0 ? tokens : item.thoughtTokens,
    title: `Thought for ${dur} second${dur === 1 ? "" : "s"}${tokenSuffix}`,
  };
}

function finalizeOutputItem(item: VariantTraceItem, variantIndex: number): VariantTraceItem {
  const tokens = item.outputTokens ?? estimateTokens(item.receivedChars);
  const tokenSuffix = tokens > 0 ? ` (${tokens.toLocaleString()} tokens)` : "";
  const label = String.fromCharCode(64 + variantIndex);
  if (item.phase === "repairing") {
    return {
      ...item,
      status: "done",
      endedAt: item.endedAt ?? Date.now(),
      title: `Refined Variant ${label} HTML (Attempt ${item.attempt ?? 2})${tokenSuffix}`,
    };
  }
  return {
    ...item,
    status: "done",
    endedAt: item.endedAt ?? Date.now(),
    title: `Generated Variant ${label} HTML${tokenSuffix}`,
  };
}

function finalizeVariantItems(
  items: VariantTraceItem[],
  variantIndex: number,
  markReady = true
): VariantTraceItem[] {
  const updated = items.map((item) => {
    if (item.status !== "running") return item;
    if (item.phase === "thinking") {
      return finalizeThinkingItem(item);
    }
    if (item.phase === "generating" || item.phase === "repairing") {
      return finalizeOutputItem(item, variantIndex);
    }
    if (item.phase === "checking") {
      return {
        ...item,
        status: "done" as const,
        endedAt: item.endedAt ?? Date.now(),
        title: "Validated WCAG 2.2 AA contrast & design system rules",
      };
    }
    return { ...item, status: "done" as const };
  });

  if (markReady && !updated.some((i) => i.phase === "ready")) {
    updated.push({
      id: "ready",
      phase: "ready",
      status: "done",
      title: "Variant markup verified & saved",
    });
  }
  return updated;
}

function updateTraces(
  prevTraces: Record<number, VariantTraceItem[]>,
  progress: GenerationProgress
): Record<number, VariantTraceItem[]> {
  const currentVariant = progress.variant;
  if (!currentVariant) return prevTraces;

  const next: Record<number, VariantTraceItem[]> = { ...prevTraces };

  // Mark any prior variants as finished & ready
  for (let v = 1; v < currentVariant; v++) {
    if (next[v]) {
      next[v] = finalizeVariantItems(next[v], v, true);
    }
  }

  const currentItems = [...(next[currentVariant] ?? [])];
  const attempt = progress.attempt ?? 1;
  const label = String.fromCharCode(64 + currentVariant);

  if (progress.stage === "thinking") {
    const thinkId = `thinking-${attempt}`;
    const existingIdx = currentItems.findIndex((i) => i.id === thinkId);
    const hasMovedPastThinking = currentItems.some(
      (i) =>
        (i.id === `generating-${attempt}` ||
          i.id === `repairing-${attempt}` ||
          i.id === `checking-${attempt}`) &&
        (i.attempt ?? 1) === attempt
    );

    if (existingIdx >= 0) {
      // Never revert a completed thinking step back to running
      if (currentItems[existingIdx].status === "done" || hasMovedPastThinking) {
        return next;
      }
      const tokens = estimateTokens(progress.thoughtChars ?? progress.thought?.length);
      currentItems[existingIdx] = {
        ...currentItems[existingIdx],
        thought: progress.thought ?? currentItems[existingIdx].thought,
        thoughtTokens: tokens > 0 ? tokens : currentItems[existingIdx].thoughtTokens,
      };
    } else if (!hasMovedPastThinking) {
      // Finalize any earlier running items from previous attempts
      for (let i = 0; i < currentItems.length; i++) {
        if (currentItems[i].status === "running") {
          if (currentItems[i].phase === "thinking") {
            currentItems[i] = finalizeThinkingItem(currentItems[i]);
          } else if (
            currentItems[i].phase === "generating" ||
            currentItems[i].phase === "repairing"
          ) {
            currentItems[i] = finalizeOutputItem(currentItems[i], currentVariant);
          }
        }
      }
      const tokens = estimateTokens(progress.thoughtChars ?? progress.thought?.length);
      currentItems.push({
        id: thinkId,
        phase: "thinking",
        status: "running",
        attempt,
        title:
          attempt > 1
            ? `Thinking about fixes (Attempt ${attempt})...`
            : "Thinking...",
        thought: progress.thought,
        thoughtTokens: tokens > 0 ? tokens : undefined,
        startedAt: Date.now(),
      });
    }
  } else if (progress.stage === "generating" || progress.stage === "repairing") {
    const thinkId = `thinking-${attempt}`;
    for (let i = 0; i < currentItems.length; i++) {
      if (currentItems[i].id === thinkId && currentItems[i].status === "running") {
        currentItems[i] = finalizeThinkingItem(
          currentItems[i],
          progress.thoughtChars
        );
      }
    }

    // Do not go backwards if checking for this attempt has already started
    if (currentItems.some((i) => i.id === `checking-${attempt}`)) {
      next[currentVariant] = currentItems;
      return next;
    }

    const genId = `${progress.stage}-${attempt}`;
    const existingIdx = currentItems.findIndex((i) => i.id === genId);
    const outputTokens = estimateTokens(progress.receivedChars);

    if (existingIdx >= 0) {
      if (currentItems[existingIdx].status === "done") {
        next[currentVariant] = currentItems;
        return next;
      }
      currentItems[existingIdx] = {
        ...currentItems[existingIdx],
        receivedChars:
          progress.receivedChars ?? currentItems[existingIdx].receivedChars,
        outputTokens:
          outputTokens > 0
            ? outputTokens
            : currentItems[existingIdx].outputTokens,
      };
    } else {
      currentItems.push({
        id: genId,
        phase: progress.stage,
        status: "running",
        attempt,
        title:
          progress.stage === "repairing"
            ? `Refining Variant ${label} HTML (Attempt ${attempt})`
            : `Generating Variant ${label} HTML`,
        receivedChars: progress.receivedChars,
        outputTokens: outputTokens > 0 ? outputTokens : undefined,
        startedAt: Date.now(),
      });
    }
  } else if (progress.stage === "checking") {
    for (let i = 0; i < currentItems.length; i++) {
      if (currentItems[i].status === "running") {
        if (currentItems[i].phase === "thinking") {
          currentItems[i] = finalizeThinkingItem(
            currentItems[i],
            progress.thoughtChars
          );
        } else if (
          currentItems[i].phase === "generating" ||
          currentItems[i].phase === "repairing"
        ) {
          currentItems[i] = finalizeOutputItem(currentItems[i], currentVariant);
        }
      }
    }

    const checkId = `checking-${attempt}`;
    const existingIdx = currentItems.findIndex((i) => i.id === checkId);
    const hasErrors = progress.errors !== undefined && progress.errors > 0;
    const passed = progress.errors === 0;
    const checkTitle = hasErrors
      ? `Found ${progress.errors} accessibility/UI kit issue${progress.errors === 1 ? "" : "s"}`
      : passed
        ? "Validated WCAG 2.2 AA contrast & design system rules"
        : "Validating WCAG 2.2 AA contrast & design system rules";

    if (existingIdx >= 0) {
      currentItems[existingIdx] = {
        ...currentItems[existingIdx],
        status: hasErrors ? "error" : passed ? "done" : "running",
        errors: progress.errors,
        title: checkTitle,
      };
    } else {
      currentItems.push({
        id: checkId,
        phase: "checking",
        status: hasErrors ? "error" : passed ? "done" : "running",
        attempt,
        title: checkTitle,
        errors: progress.errors,
      });
    }
  } else if (progress.stage === "saving") {
    for (const v of Object.keys(next)) {
      const idx = Number(v);
      next[idx] = finalizeVariantItems(next[idx], idx, true);
    }
    return next;
  }

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
          const cached =
            prev.jobId === jobId
              ? prev
              : { jobId, ...EMPTY, ...loadCachedState(jobId) };
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
            for (const v of Object.keys(finishedTraces)) {
              const idx = Number(v);
              finishedTraces[idx] = finalizeVariantItems(
                finishedTraces[idx],
                idx,
                true
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
