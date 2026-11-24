"use client";

import { useEffect, useState } from "react";
import {
  followJobEvents,
  GenerationProgress,
  JobSnapshot,
} from "@/lib/generation-client";

export interface JobStreamState {
  snapshot: JobSnapshot | null;
  progress: GenerationProgress | null;
  /** The stream itself could not be read (not a failed job). */
  streamError: string | null;
}

const EMPTY: JobStreamState = {
  snapshot: null,
  progress: null,
  streamError: null,
};

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
          return event.type === "progress"
            ? { ...base, progress: event.data, streamError: null }
            : { ...base, snapshot: event.data, streamError: null };
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
