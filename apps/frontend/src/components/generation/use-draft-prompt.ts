"use client";

import * as React from "react";
import {
  getUserStoryById,
  getDesignIntent,
  listPersonas,
  UserStoryItem,
  DesignIntentDetail,
  PersonaItem,
} from "@/lib/project-client";
import { API_URL } from "@/lib/api-client";
import { fetchSse, readSseStream, sseErrorMessage } from "@/lib/sse";
import { estimateTokens } from "@/components/generation/use-job-stream";

/** The structured prompt the drafter returns (every field may be missing). */
export interface DraftedPrompt {
  goal?: string;
  problem?: string;
  mustUse?: string;
  comparisonQuestion?: string;
  variantA?: { name?: string; description?: string };
  variantB?: { name?: string; description?: string };
  personaId?: string;
  thought?: string;
  thoughtChars?: number;
  thoughtDurationSeconds?: number;
}

/** One progress frame of `GET .../rounds/draft-prompt/events`. */
interface DraftPromptEvent {
  status?: string;
  stage?: string;
  thought?: string;
  thoughtChars?: number;
  charsReceived?: number;
  thoughtDurationSeconds?: number;
  prompt?: DraftedPrompt;
}

/**
 * Loads a story with the project's design intent and personas, then streams
 * the AI-drafted structured prompt for it. `onPrompt` receives the prompt
 * once drafted; progress, the model's reasoning and errors are returned.
 */
export function useDraftPrompt(
  projectId: string,
  storyId: string | null,
  onPrompt: (prompt: DraftedPrompt) => void
) {
  const [story, setStory] = React.useState<UserStoryItem | null>(null);
  const [intent, setIntent] = React.useState<DesignIntentDetail | null>(null);
  const [personas, setPersonas] = React.useState<PersonaItem[]>([]);
  /** The persona the prompt was drafted for. */
  const [draftedPersonaId, setDraftedPersonaId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [backendStatus, setBackendStatus] = React.useState<string | null>(
    "Drafting your prompt with AI..."
  );
  const [thoughtText, setThoughtText] = React.useState<string>("");
  const [thoughtTokens, setThoughtTokens] = React.useState<number>(0);
  const [outputTokens, setOutputTokens] = React.useState<number>(0);
  const [thoughtDurationSeconds, setThoughtDurationSeconds] = React.useState<number | null>(null);

  const onPromptRef = React.useRef(onPrompt);
  React.useEffect(() => {
    onPromptRef.current = onPrompt;
  });
  const retryRef = React.useRef<() => void>(() => {});

  React.useEffect(() => {
    let isCancelled = false;
    let abortController = new AbortController();

    async function loadData(refresh = false) {
      if (!storyId || !projectId) return;

      abortController.abort();
      abortController = new AbortController();

      setIsLoading(true);
      setError(null);
      setBackendStatus("Drafting your prompt with AI...");
      setThoughtText("");
      setThoughtTokens(0);
      setOutputTokens(0);
      setThoughtDurationSeconds(null);

      try {
        const [storyData, intentData, personaList] = await Promise.all([
          getUserStoryById(projectId, storyId),
          getDesignIntent(projectId).catch(() => null),
          listPersonas(projectId).catch(() => []),
        ]);

        if (isCancelled || abortController.signal.aborted) return;

        setStory(storyData);
        setIntent(intentData);
        setPersonas(personaList);

        const savedDraft =
          !refresh &&
          storyData.draftPrompt &&
          typeof storyData.draftPrompt === "object"
            ? (storyData.draftPrompt as DraftedPrompt)
            : null;

        if (savedDraft) {
          const restoredPersonaId =
            savedDraft.personaId || personaList[0]?.id || "";
          setDraftedPersonaId(restoredPersonaId);
          if (savedDraft.thought) {
            setThoughtText(savedDraft.thought);
          }
          const tokens = estimateTokens(
            savedDraft.thoughtChars ?? savedDraft.thought?.length
          );
          if (tokens > 0) setThoughtTokens(tokens);
          if (typeof savedDraft.thoughtDurationSeconds === "number") {
            setThoughtDurationSeconds(savedDraft.thoughtDurationSeconds);
          }
          onPromptRef.current(savedDraft);
          setIsLoading(false);
          setBackendStatus(null);
          return;
        }

        const initialPersona = personaList[0];
        const personaIdToUse = initialPersona?.id || "";
        setDraftedPersonaId(personaIdToUse);

        // Start SSE stream from backend to draft prompt
        const sseUrl = `${API_URL}/projects/${projectId}/rounds/draft-prompt/events?storyId=${storyId}${
          personaIdToUse ? `&personaId=${personaIdToUse}` : ""
        }${refresh ? "&refresh=true" : ""}`;

        try {
          const res = await fetchSse(sseUrl, abortController.signal);

          if (!res.ok || !res.body) {
            const errText = await res.text().catch(() => "");
            let errorMsg = `Backend stream failed (${res.status} ${res.statusText})`;
            try {
              const parsedErr = JSON.parse(errText);
              if (parsedErr?.message) errorMsg = parsedErr.message;
            } catch {
              if (errText) errorMsg += `: ${errText}`;
            }
            setError(errorMsg);
            setIsLoading(false);
            setBackendStatus(null);
            return;
          }

          // The backend reports a failure as an `event: error` frame whose
          // data is the plain error message (not JSON): surface it.
          const outcome: { drafted: boolean; error: string | null } = {
            drafted: false,
            error: null,
          };
          await readSseStream(res.body, (event) => {
            if (event.type === "heartbeat") return;
            if (event.type === "error") {
              outcome.error = sseErrorMessage(event.data, "Drafting the prompt failed.");
              return false;
            }
            const parsed = event.data as DraftPromptEvent;
            if (!parsed || typeof parsed !== "object") return;
            if (parsed.status) setBackendStatus(parsed.status);
            if (parsed.thought) setThoughtText(parsed.thought);
            const tTokens = estimateTokens(
              parsed.thoughtChars ?? parsed.thought?.length
            );
            if (tTokens > 0) setThoughtTokens(tTokens);
            const oTokens = estimateTokens(parsed.charsReceived);
            if (oTokens > 0) setOutputTokens(oTokens);
            if (typeof parsed.thoughtDurationSeconds === "number") {
              setThoughtDurationSeconds(parsed.thoughtDurationSeconds);
            }

            if (parsed.prompt) {
              const pTokens = estimateTokens(
                parsed.prompt.thoughtChars ?? parsed.prompt.thought?.length
              );
              if (pTokens > 0) setThoughtTokens(pTokens);
              if (typeof parsed.prompt.thoughtDurationSeconds === "number") {
                setThoughtDurationSeconds(parsed.prompt.thoughtDurationSeconds);
              }
              onPromptRef.current(parsed.prompt);
              outcome.drafted = true;
              setIsLoading(false);
              setBackendStatus(null);
            }
          });

          if (!abortController.signal.aborted && !isCancelled) {
            if (outcome.error) {
              setError(outcome.error);
            } else if (!outcome.drafted) {
              setError("Drafting ended before the prompt was ready. Try again.");
            }
          }
        } catch (fetchErr: unknown) {
          if ((fetchErr as Error).name !== "AbortError") {
            const msg = (fetchErr as Error).message || "Failed to connect to prompt drafting service.";
            setError(msg);
          }
        } finally {
          if (!isCancelled && !abortController.signal.aborted) {
            setIsLoading(false);
            setBackendStatus(null);
          }
        }
      } catch (err: unknown) {
        if (!isCancelled && !abortController.signal.aborted) {
          const msg = (err as Error).message || "Failed to load project details for prompt drafting.";
          setError(msg);
          setIsLoading(false);
          setBackendStatus(null);
        }
      }
    }

    retryRef.current = () => {
      void loadData(true);
    };

    if (projectId && storyId) {
      void loadData();
    }

    return () => {
      isCancelled = true;
      abortController.abort();
    };
  }, [projectId, storyId]);

  const retry = React.useCallback(() => retryRef.current(), []);

  return {
    story,
    intent,
    personas,
    draftedPersonaId,
    error,
    setError,
    isLoading,
    backendStatus,
    thoughtText,
    thoughtTokens,
    outputTokens,
    thoughtDurationSeconds,
    retry,
  };
}
