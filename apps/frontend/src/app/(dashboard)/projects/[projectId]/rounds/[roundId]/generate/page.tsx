"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HugeIcon } from "@/components/ui/huge-icon";
import type { IconSvgElement } from "@hugeicons/react";
import {
  AiBrain01Icon,
  Alert02Icon,
  CheckmarkCircle02Icon,
  CircleIcon,
  File01Icon,
  Loading03Icon,
  SecurityCheckIcon,
  SourceCodeIcon,
  Tick02Icon,
  Wrench01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import {
  Trace,
  TraceLine,
  TraceIcon,
  TraceTitle,
  TraceDescription,
  TraceCollapsible,
  TraceCollapsibleTrigger,
  TraceCollapsibleContent,
} from "@/components/ui/trace";
import { useStoryBreadcrumbs } from "@/components/layout/use-story-breadcrumbs";
import {
  useJobStream,
  VariantTraceItem,
} from "@/components/generation/use-job-stream";
import {
  cancelGenerationJob,
  GenerationJob,
  GenerationJobStatus,
  GenerationOutputVariant,
  GenerationProgress,
  getGenerationJob,
  listRoundJobs,
  listRoundVariants,
  retryGeneration,
} from "@/lib/generation-client";

const LABELS = ["A", "B", "C", "D"];
const DESIGN_SYSTEM_NAMES: Record<string, string> = {
  SHADCN: "shadcn/ui",
  MUI: "MUI",
};

type StepState = "done" | "active" | "todo";

/** Status line of one variant card, from the job's live progress. */
function variantStatus(
  index: number,
  status: GenerationJobStatus,
  progress: GenerationProgress | null,
  traces: VariantTraceItem[] = []
): { text: string; busy: boolean; done: boolean } {
  if (status === "SUCCEEDED") return { text: "Ready", busy: false, done: true };
  if (status === "FAILED") return { text: "Failed", busy: false, done: false };
  if (status === "CANCELLED")
    return { text: "Cancelled", busy: false, done: false };

  const isReady = traces.some((t) => t.phase === "ready" && t.status === "done");
  const hasItemsRunning = traces.some((t) => t.status === "running");
  const current = progress?.variant ?? 0;

  if (isReady || current > index) {
    return { text: "Done", busy: false, done: true };
  }

  if (current === index || hasItemsRunning) {
    if (progress?.stage === "thinking") {
      return { text: "Reasoning about layout…", busy: true, done: false };
    }
    if (progress?.stage === "checking") {
      return { text: "Checking accessibility…", busy: true, done: false };
    }
    if (progress?.stage === "repairing") {
      return {
        text: "Polishing…",
        busy: true,
        done: false,
      };
    }
    return { text: "Laying out…", busy: true, done: false };
  }

  if (!progress || status === "QUEUED") {
    return { text: "Waiting", busy: false, done: false };
  }

  if (progress.stage === "saving") {
    return { text: "Saving…", busy: true, done: false };
  }

  const starting =
    index === 1 && (progress.stage === "started" || progress.stage === "persona");
  return starting
    ? { text: "Reading your intent…", busy: true, done: false }
    : { text: "Waiting", busy: false, done: false };
}

function getVariantState(
  i: number,
  variantCount: number,
  status: GenerationJobStatus,
  progress: GenerationProgress | null,
  tracesByVariant: Record<number, VariantTraceItem[]> = {}
): StepState {
  const finished = status === "SUCCEEDED";
  const stage = progress?.stage;
  const current = progress?.variant ?? 0;
  const pastPersona =
    finished ||
    (stage !== undefined && stage !== "started" && stage !== "persona");
  const vTraces = tracesByVariant[i] ?? [];
  const isReady = vTraces.some(
    (t) => t.phase === "ready" && t.status === "done"
  );
  const nextVariantHasItems = Boolean(
    (tracesByVariant[i + 1] && tracesByVariant[i + 1].length > 0) || current > i
  );
  const hasRunningItem = vTraces.some((t) => t.status === "running");

  const isDone =
    finished ||
    stage === "saving" ||
    current > i ||
    (isReady && (nextVariantHasItems || i < variantCount));

  if (isDone) return "done";
  if ((current === i || hasRunningItem) && pastPersona) return "active";
  return "todo";
}

function SharedIntentBanner({
  job,
  status,
  progress,
  designSystem,
  standard,
  openThoughtKey,
  onToggleThought,
}: {
  job: GenerationJob;
  status: GenerationJobStatus;
  progress: GenerationProgress | null;
  designSystem: string;
  standard: string;
  openThoughtKey: string | null;
  onToggleThought: (key: string, open: boolean) => void;
}) {
  const finished = status === "SUCCEEDED";
  const stage = progress?.stage;
  const started = status === "RUNNING" || finished || Boolean(progress);
  const pastPersona =
    finished ||
    (stage !== undefined && stage !== "started" && stage !== "persona");
  const isDone = pastPersona || stage === "persona";
  const isActive = !isDone && started;

  const fullTitle = job.inputSnapshot?.stories?.[0]?.title;
  const storyTitle =
    fullTitle && fullTitle.length > 55
      ? `${fullTitle.slice(0, 54).trimEnd()}…`
      : fullTitle;

  const personaThought =
    job.outputMetadata?.personaThought;
  const personaRunning = stage === "persona";

  return (
    <div className="w-full flex flex-col gap-2 rounded-[14px] border border-border bg-card p-4 sm:p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center size-6 shrink-0 rounded-full bg-muted">
          {isDone ? (
            <HugeIcon icon={Tick02Icon} size={16} className="text-primary-text" />
          ) : isActive ? (
            <HugeIcon icon={Loading03Icon} size={14} className="animate-spin text-foreground" />
          ) : (
            <HugeIcon icon={CircleIcon} size={14} className="text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-1 items-center justify-between min-w-0 flex-wrap gap-2">
          <span className="font-heading text-sm sm:text-base font-medium text-foreground truncate">
            {storyTitle
              ? `Read design intent and “${storyTitle}”`
              : "Read design intent and user story"}
          </span>
          <span className="text-xs font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">
            {designSystem} • {standard}
          </span>
        </div>
      </div>

      {(isDone || job.inputSnapshot?.synthesizePersona) && (
        <Trace className="mt-1 pl-9">
          {isDone && (
            <TraceCollapsible>
              <TraceCollapsibleTrigger>
                <TraceLine>
                  <TraceIcon>
                    <HugeIcon icon={File01Icon} size={16} />
                  </TraceIcon>
                  <TraceTitle>Design intent &amp; context summary</TraceTitle>
                </TraceLine>
              </TraceCollapsibleTrigger>
              <TraceCollapsibleContent className="space-y-1 text-xs">
                <p>
                  Story: &ldquo;
                  {job.inputSnapshot?.stories?.[0]?.title ??
                    "Primary user workflow"}
                  &rdquo;
                </p>
                <p>UI library: {designSystem}</p>
                <p>Standard: {standard}</p>
                <p>Accessibility &amp; color tokens injected into context.</p>
              </TraceCollapsibleContent>
            </TraceCollapsible>
          )}

          {job.inputSnapshot?.synthesizePersona && (
            <TraceCollapsible
              open={openThoughtKey === "persona"}
              onOpenChange={(open) => onToggleThought("persona", open)}
            >
              <TraceCollapsibleTrigger>
                <TraceLine status={personaRunning ? "running" : undefined}>
                  <TraceIcon>
                    <TraceStateIcon
                      state={personaRunning ? "running" : pastPersona ? "done" : "pending"}
                      icon={AiBrain01Icon}
                    />
                  </TraceIcon>
                  <TraceTitle>
                    {personaRunning
                      ? "Drafting a persona from your prompt…"
                      : "Drafted a persona from your prompt"}
                  </TraceTitle>
                </TraceLine>
              </TraceCollapsibleTrigger>
              <TraceCollapsibleContent>
                <ThoughtText>
                  {personaThought ||
                    "Synthesized target user persona from your prompt and project design intent."}
                </ThoughtText>
              </TraceCollapsibleContent>
            </TraceCollapsible>
          )}
        </Trace>
      )}
    </div>
  );
}

/**
 * What the markup check found. The check reads static markup only (no
 * contrast, focus order or zoom), so it never claims more than that.
 */
function CheckResults({
  running,
  standard,
  designSystem,
  outputVariant,
}: {
  running: boolean;
  standard: string;
  designSystem: string;
  outputVariant?: GenerationOutputVariant;
}) {
  if (running || !outputVariant) {
    return (
      <p>
        Checking the markup against {standard} rules and {designSystem}{" "}
        components…
      </p>
    );
  }
  if (!outputVariant.passed) {
    const issues = outputVariant.issues ?? [];
    return (
      <>
        <p className="text-destructive">
          Still failing after {outputVariant.attempts} attempt
          {outputVariant.attempts === 1 ? "" : "s"}:
        </p>
        <ul className="list-disc space-y-0.5 pl-4">
          {issues.slice(0, 6).map((issue, i) => (
            <li key={i}>
              {issue.criterion ? `WCAG ${issue.criterion}: ` : ""}
              {issue.message}
            </li>
          ))}
        </ul>
      </>
    );
  }
  const warnings = outputVariant.warnings ?? 0;
  const removed = outputVariant.removed ?? [];
  return (
    <>
      <p>
        Passed {standard} markup rules and {designSystem} component checks
        {outputVariant.attempts > 1
          ? ` after ${outputVariant.attempts} attempts`
          : ""}
        .
      </p>
      <p>
        {warnings === 0
          ? "No warnings."
          : `${warnings} warning${warnings === 1 ? "" : "s"} left to review.`}
      </p>
      {removed.length > 0 && (
        <p>Removed for safety: {removed.slice(0, 4).join(", ")}.</p>
      )}
      <p className="text-muted-foreground/70">
        Static markup only: contrast, focus order and zoom are not checked here.
      </p>
    </>
  );
}

type TraceState = "running" | "done" | "error" | "pending";

/** Phase icon of a trace step; every running step shows the same spinner. */
function TraceStateIcon({
  state,
  icon,
}: {
  state: TraceState;
  icon: IconSvgElement;
}) {
  if (state === "running") {
    return <HugeIcon icon={Loading03Icon} size={16} className="animate-spin" />;
  }
  if (state === "error") {
    return <HugeIcon icon={Alert02Icon} size={16} />;
  }
  return <HugeIcon icon={icon} size={16} />;
}

/** Streamed model reasoning inside an open trace step. */
function ThoughtText({ children }: { children: React.ReactNode }) {
  return (
    <p className="max-h-48 overflow-y-auto whitespace-pre-wrap text-xs select-text">
      {children}
    </p>
  );
}

const PHASE_ICONS: Record<VariantTraceItem["phase"], IconSvgElement> = {
  thinking: AiBrain01Icon,
  generating: SourceCodeIcon,
  checking: SecurityCheckIcon,
  repairing: Wrench01Icon,
  ready: CheckmarkCircle02Icon,
};

function traceState(status: VariantTraceItem["status"]): TraceState {
  if (status === "running") return "running";
  if (status === "error") return "error";
  return "done";
}

function lineStatus(state: TraceState): "running" | "error" | undefined {
  return state === "running" || state === "error" ? state : undefined;
}

function getVariantTraces(
  variantIdx: number,
  standard: string,
  liveTraces: VariantTraceItem[],
  outputVariant?: GenerationOutputVariant,
  thought?: string,
  stepState?: StepState
): VariantTraceItem[] {
  const effectiveThought = thought ?? outputVariant?.thought;

  if (liveTraces.length > 0) {
    const items = liveTraces.map((item) => {
      if (item.phase === "thinking" && (item.attempt ?? 1) === 1 && !item.thought && effectiveThought) {
        return { ...item, thought: effectiveThought };
      }
      return item;
    });
    if (outputVariant && !outputVariant.passed) {
      const failed: VariantTraceItem = {
        id: "checking-final",
        phase: "checking",
        status: "error",
        title: "Couldn't pass the markup & UI kit check",
      };
      return [...items.filter((i) => i.phase !== "checking" && i.phase !== "ready"), failed];
    }
    return items;
  }

  if (stepState === "done" || Boolean(outputVariant)) {
    // Only measured values from the job: older jobs did not record timings,
    // so they show no duration rather than a guess.
    const list: VariantTraceItem[] = [];
    const label = String.fromCharCode(64 + variantIdx);
    const thinkingSeconds =
      outputVariant?.thinkingMs !== undefined
        ? Math.max(1, Math.round(outputVariant.thinkingMs / 1000))
        : undefined;

    if (effectiveThought) {
      list.push({
        id: "thinking-1",
        phase: "thinking",
        status: "done",
        attempt: 1,
        title:
          thinkingSeconds !== undefined
            ? `Thought for ${thinkingSeconds} second${thinkingSeconds === 1 ? "" : "s"}`
            : "Thought",
        thought: effectiveThought,
        thoughtDurationSeconds: thinkingSeconds,
      });
    }
    list.push({
      id: "generating-1",
      phase: "generating",
      status: "done",
      attempt: 1,
      title: `Generated Variant ${label} HTML`,
      outputTokens: outputVariant?.completionTokens,
    });
    list.push({
      id: "checking-1",
      phase: "checking",
      status: outputVariant && !outputVariant.passed ? "error" : "done",
      attempt: 1,
      title:
        outputVariant && !outputVariant.passed
          ? "Couldn't pass the markup & UI kit check"
          : `Checked markup against ${standard} & the UI kit`,
    });
    if (outputVariant?.attempts && outputVariant.attempts > 1) {
      list.push({
        id: `repairing-${outputVariant.attempts}`,
        phase: "repairing",
        status: "done",
        title: `Polished Variant ${label}`,
        attempt: outputVariant.attempts,
      });
    }
    list.push({
      id: "ready",
      phase: "ready",
      status: "done",
      title: "Variant saved",
    });
    return list;
  }

  if (stepState === "active") {
    return [
      {
        id: "thinking-1",
        phase: "thinking",
        status: "running",
        attempt: 1,
        title: "Thinking...",
        thought: effectiveThought,
      },
    ];
  }
  return [];
}

function VariantCard({
  label,
  index,
  status,
  progress,
  traces = [],
  outputVariant,
  thought,
  stepState,
  standard,
  designSystem,
  openThoughtKey,
  onToggleThought,
}: {
  label: string;
  index: number;
  status: GenerationJobStatus;
  progress: GenerationProgress | null;
  traces?: VariantTraceItem[];
  outputVariant?: GenerationOutputVariant;
  thought?: string;
  stepState: StepState;
  standard: string;
  designSystem: string;
  openThoughtKey: string | null;
  onToggleThought: (key: string, open: boolean) => void;
}) {
  const line = variantStatus(index, status, progress, traces);
  const variantTraces = getVariantTraces(
    index,
    standard,
    traces,
    outputVariant,
    thought,
    stepState
  );

  return (
    <div className="flex flex-col gap-4 rounded-[14px] border border-border bg-card p-5 sm:p-6 shadow-sm min-h-[300px]">
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "size-2.5 shrink-0 rounded-full",
              index % 2 === 1 ? "bg-design-a" : "bg-design-b"
            )}
            aria-hidden="true"
          />
          <h2 className="font-heading text-lg font-medium leading-6 text-foreground">
            Variant {label}
          </h2>
        </div>
        <div className="flex items-center gap-1.5" aria-live="polite">
          {line.busy && (
            <HugeIcon
              icon={Loading03Icon}
              size={14}
              className="animate-spin text-foreground"
            />
          )}
          {line.done && (
            <HugeIcon
              icon={Tick02Icon}
              size={14}
              className="text-primary-text"
            />
          )}
          <p className="text-xs font-medium text-muted-foreground">{line.text}</p>
        </div>
      </div>

      {variantTraces.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
          <HugeIcon
            icon={CircleIcon}
            size={18}
            className="text-muted-foreground/40"
          />
          <p className="text-xs">
            {index === 1
              ? "Preparing layout and component hierarchy…"
              : "Waiting for Variant A to finish…"}
          </p>
        </div>
      ) : (
        <Trace className="flex-1">
          {variantTraces.map((item) => {
            const state = traceState(item.status);
            const icon = (
              <TraceIcon>
                <TraceStateIcon state={state} icon={PHASE_ICONS[item.phase]} />
              </TraceIcon>
            );

            if (item.phase === "thinking") {
              const running = state === "running";
              const title = running
                ? "Thinking…"
                : item.title;
              const thoughtKey = `v${index}-${item.id}`;
              const tokens = running ? item.thoughtTokens : undefined;
              const line = (
                <TraceLine status={lineStatus(state)}>
                  {icon}
                  <TraceTitle>{title}</TraceTitle>
                  {tokens ? (
                    <TraceDescription>
                      ~{tokens.toLocaleString()} tokens
                    </TraceDescription>
                  ) : null}
                </TraceLine>
              );
              if (!item.thought) return <div key={item.id}>{line}</div>;
              return (
                <TraceCollapsible
                  key={item.id}
                  open={openThoughtKey === thoughtKey}
                  onOpenChange={(open) => onToggleThought(thoughtKey, open)}
                >
                  <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
                  <TraceCollapsibleContent>
                    <ThoughtText>{item.thought}</ThoughtText>
                  </TraceCollapsibleContent>
                </TraceCollapsible>
              );
            }

            if (item.phase === "checking") {
              return (
                <TraceCollapsible key={item.id}>
                  <TraceCollapsibleTrigger>
                    <TraceLine status={lineStatus(state)}>
                      {icon}
                      <TraceTitle>{item.title}</TraceTitle>
                    </TraceLine>
                  </TraceCollapsibleTrigger>
                  <TraceCollapsibleContent className="space-y-1 text-xs">
                    <CheckResults
                      running={state === "running"}
                      standard={standard}
                      designSystem={designSystem}
                      outputVariant={outputVariant}
                    />
                  </TraceCollapsibleContent>
                </TraceCollapsible>
              );
            }

            const tokens =
              item.phase === "generating" || item.phase === "repairing"
                ? item.outputTokens
                : undefined;
            const durationSeconds =
              item.phase === "ready" && outputVariant?.durationMs !== undefined
                ? Math.max(1, Math.round(outputVariant.durationMs / 1000))
                : undefined;
            return (
              <div key={item.id}>
                <TraceLine status={lineStatus(state)}>
                  {icon}
                  <TraceTitle>{item.title}</TraceTitle>
                  {tokens ? (
                    <TraceDescription>
                      {/* Live counts are estimated from streamed text. */}
                      {state === "running" ? "~" : ""}
                      {tokens.toLocaleString()} tokens
                    </TraceDescription>
                  ) : null}
                  {durationSeconds !== undefined && (
                    <TraceDescription>{durationSeconds}s total</TraceDescription>
                  )}
                </TraceLine>
              </div>
            );
          })}
        </Trace>
      )}
    </div>
  );
}

function GeneratingContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params.projectId as string;
  const roundId = params.roundId as string;
  const jobParam = searchParams.get("job");

  const [job, setJob] = React.useState<GenerationJob | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [busyAction, setBusyAction] = React.useState<"cancel" | "retry" | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);

  // The job to follow: ?job=…, else the latest job of the round.
  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const found = jobParam
          ? await getGenerationJob(projectId, jobParam)
          : (await listRoundJobs(projectId, roundId)).at(-1);
        if (!active) return;
        if (!found) {
          setLoadError("This round has no generation yet.");
          return;
        }
        const earlier = await listRoundVariants(projectId, roundId);
        if (!active) return;
        if (found.baseVariantId || earlier.some((v) => v.generationJobId !== found.id)) {
          // Only the first A/B generation has this page; refinements are
          // followed in the Refine page's chat.
          router.replace(`/projects/${projectId}/rounds/${roundId}/refine`);
          return;
        }
        setJob(found);
      } catch {
        if (active) setLoadError("Couldn't load the generation job.");
      }
    })();
    return () => {
      active = false;
    };
  }, [projectId, roundId, jobParam, router]);

  const live = useJobStream(projectId, job?.id ?? null);
  const status: GenerationJobStatus = live.snapshot?.status ?? job?.status ?? "QUEUED";
  const errorText = live.snapshot?.error ?? job?.error ?? null;

  // Track running thought key to auto-expand active thought and auto-collapse when next item appears
  const [prevRunningKey, setPrevRunningKey] = React.useState<string | null>(null);
  const [manuallyOpenedKey, setManuallyOpenedKey] = React.useState<string | null>(null);
  const [manuallyClosedKey, setManuallyClosedKey] = React.useState<string | null>(null);

  const currentRunningThoughtKey = React.useMemo(() => {
    const progress = live.progress;
    if (progress?.stage === "persona") {
      return "persona";
    }
    for (let idx = 1; idx <= (job?.variantCount ?? 2); idx++) {
      const traces = live.tracesByVariant[idx] ?? [];
      const running = traces.find(
        (t) => t.phase === "thinking" && t.status === "running"
      );
      if (running) {
        return `v${idx}-${running.id}`;
      }
    }
    return null;
  }, [live.progress, live.tracesByVariant, job?.variantCount]);

  // Adjust state during render when running thought changes (auto-collapse previous thought when new thought appears)
  if (currentRunningThoughtKey !== prevRunningKey) {
    setPrevRunningKey(currentRunningThoughtKey);
    setManuallyOpenedKey(null);
    setManuallyClosedKey(null);
  }

  const openThoughtKey =
    status === "SUCCEEDED"
      ? manuallyOpenedKey
      : (manuallyOpenedKey ?? (manuallyClosedKey === currentRunningThoughtKey ? null : currentRunningThoughtKey));

  const handleToggleThought = React.useCallback((key: string, open: boolean) => {
    if (open) {
      setManuallyOpenedKey(key);
      setManuallyClosedKey(null);
    } else {
      setManuallyOpenedKey(null);
      setManuallyClosedKey(key);
    }
  }, []);

  React.useEffect(() => {
    if (status === "SUCCEEDED") {
      router.replace(`/projects/${projectId}/rounds/${roundId}/refine`);
    } else if (status === "CANCELLED") {
      const storyId = job?.inputSnapshot?.stories?.[0]?.id;
      if (storyId) {
        router.replace(`/projects/${projectId}/rounds/new?storyId=${storyId}`);
      }
    }
  }, [status, router, projectId, roundId, job]);

  useStoryBreadcrumbs(projectId, job?.inputSnapshot?.stories?.[0]?.id, "Generating");

  const handleCancel = async () => {
    if (!job) return;
    setBusyAction("cancel");
    setActionError(null);
    try {
      if (status === "QUEUED" || status === "RUNNING") {
        await cancelGenerationJob(projectId, job.id);
      }
      const storyId = job.inputSnapshot?.stories?.[0]?.id;
      if (storyId) {
        router.push(`/projects/${projectId}/rounds/new?storyId=${storyId}`);
      } else {
        router.push(`/projects/${projectId}`);
      }
    } catch {
      setActionError("Couldn't cancel the generation. Try again.");
      setBusyAction(null);
    }
  };

  const handleRetry = async () => {
    if (!job) return;
    setBusyAction("retry");
    setActionError(null);
    try {
      const next = await retryGeneration(projectId, job);
      setJob(next);
      router.replace(`/projects/${projectId}/rounds/${roundId}/generate?job=${next.id}`);
    } catch {
      setActionError("Couldn't start the generation again.");
    } finally {
      setBusyAction(null);
    }
  };

  if (loadError) {
    return (
      <div className="w-full px-10 py-10">
        <Alert variant="destructive">
          <HugeIcon icon={Alert02Icon} size={16} />
          <AlertTitle>Nothing to show</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex w-full justify-center py-24">
        <HugeIcon icon={Loading03Icon} size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const designSystem =
    DESIGN_SYSTEM_NAMES[job.uiLibrary] ??
    job.inputSnapshot?.intent?.designSystem ??
    job.uiLibrary;
  const standard =
    job.inputSnapshot?.intent?.designStandards?.[0] ?? "WCAG 2.2 AA";
  const labels = LABELS.slice(0, job.variantCount);
  const ended = status === "FAILED" || status === "CANCELLED";

  return (
    <div className="flex w-full flex-col gap-8 px-6 sm:px-10 py-10">
      <div className="flex w-full flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-heading text-2xl font-medium leading-8 tracking-[-0.01em] text-foreground">
            Building {labels.join(" and ")} from {designSystem}
          </h1>
          <p className="text-base leading-6 text-muted-foreground">
            This takes a few minutes. Feel free to leave. We&apos;ll keep working on your designs in the background.
          </p>
        </div>

        {ended && (
          <Alert variant="destructive" className="max-w-[896px]">
            <HugeIcon icon={Alert02Icon} size={16} />
            <AlertTitle>
              {status === "FAILED" ? "Generation failed" : "Generation cancelled"}
            </AlertTitle>
            <AlertDescription>
              {errorText ?? "No designs were saved."}
            </AlertDescription>
          </Alert>
        )}
        {(actionError || live.streamError) && (
          <Alert variant="destructive" className="max-w-[896px]">
            <HugeIcon icon={Alert02Icon} size={16} />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{actionError ?? live.streamError}</AlertDescription>
          </Alert>
        )}

        <div className="w-full max-w-5xl flex flex-col gap-6 items-center">
          {/* Shared design intent context bar */}
          <SharedIntentBanner
            job={job}
            status={status}
            progress={live.progress}
            designSystem={designSystem}
            standard={standard}
            openThoughtKey={openThoughtKey}
            onToggleThought={handleToggleThought}
          />

          {/* Side-by-side Variant cards with embedded traces */}
          <div className="grid grid-cols-1 md:grid-cols-2 w-full gap-6">
            {labels.map((label, i) => {
              const variantIndex = i + 1;
              const outputVariant = job.outputMetadata?.variants?.find(
                (v) => v.variant === variantIndex
              );
              const stepThought =
                live.thoughtsByVariant[variantIndex] ??
                (live.progress?.variant === variantIndex ? live.progress.thought : undefined) ??
                outputVariant?.thought;
              const vState = getVariantState(
                variantIndex,
                job.variantCount,
                status,
                live.progress,
                live.tracesByVariant
              );

              return (
                <VariantCard
                  key={label}
                  label={label}
                  index={variantIndex}
                  status={status}
                  progress={live.progress}
                  traces={live.tracesByVariant[variantIndex]}
                  outputVariant={outputVariant}
                  thought={stepThought}
                  stepState={vState}
                  standard={standard}
                  designSystem={designSystem}
                  openThoughtKey={openThoughtKey}
                  onToggleThought={handleToggleThought}
                />
              );
            })}
          </div>
        </div>

        {ended ? (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                const storyId = job.inputSnapshot?.stories?.[0]?.id;
                if (storyId) {
                  router.push(`/projects/${projectId}/rounds/new?storyId=${storyId}`);
                } else {
                  router.push(`/projects/${projectId}`);
                }
              }}
            >
              {status === "CANCELLED" ? "Review prompt" : "Back to project"}
            </Button>
            <Button onClick={handleRetry} disabled={busyAction !== null}>
              {busyAction === "retry" ? "Starting…" : "Try again"}
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            onClick={() => setCancelDialogOpen(true)}
            disabled={busyAction !== null || status === "SUCCEEDED"}
          >
            {busyAction === "cancel" ? "Cancelling…" : "Cancel"}
          </Button>
        )}
      </div>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Cancel generation?</DialogTitle>
            <DialogDescription>
              This will stop generating Variant A and B and return you to your structured prompt.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              disabled={busyAction === "cancel"}
            >
              Keep generating
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setCancelDialogOpen(false);
                void handleCancel();
              }}
              disabled={busyAction === "cancel"}
            >
              {busyAction === "cancel" ? "Cancelling…" : "Cancel generation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function GeneratingABPage() {
  return (
    <React.Suspense fallback={null}>
      <GeneratingContent />
    </React.Suspense>
  );
}
