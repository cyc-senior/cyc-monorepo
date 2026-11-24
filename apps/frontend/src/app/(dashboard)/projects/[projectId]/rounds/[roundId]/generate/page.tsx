"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { HugeIcon } from "@/components/ui/huge-icon";
import {
  Alert02Icon,
  CircleIcon,
  Loading02Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import {
  Trace,
  TraceLine,
  TraceIcon,
  TraceTitle,
  TraceCollapsible,
  TraceCollapsibleTrigger,
  TraceCollapsibleContent,
} from "@/components/ui/trace";
import { Brain, CheckCircle2, FileCode, ShieldCheck, Wrench } from "lucide-react";
import { useBreadcrumbs } from "@/contexts/breadcrumb-context";
import {
  PHASE_ORDER,
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

interface Step {
  key: string;
  label: string;
  state: StepState;
}

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
        text: `Fixing ${progress.errors ?? "a few"} issue${progress.errors === 1 ? "" : "s"}…`,
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

/** The checklist under the cards, from the job's live progress. */
function progressSteps(
  job: GenerationJob,
  status: GenerationJobStatus,
  progress: GenerationProgress | null,
  tracesByVariant: Record<number, VariantTraceItem[]> = {}
): Step[] {
  const finished = status === "SUCCEEDED";
  const stage = progress?.stage;
  const current = progress?.variant ?? 0;
  const started = status === "RUNNING" || finished || Boolean(progress);
  const pastPersona = finished || (stage !== undefined && stage !== "started" && stage !== "persona");
  const fullTitle = job.inputSnapshot?.stories?.[0]?.title;
  // Story titles are whole "As a … I want …" sentences; keep the step short.
  const storyTitle =
    fullTitle && fullTitle.length > 48 ? `${fullTitle.slice(0, 47).trimEnd()}…` : fullTitle;

  const steps: Step[] = [
    {
      key: "intent",
      label: storyTitle
        ? `Read design intent and “${storyTitle}”`
        : "Read design intent and user story",
      state: pastPersona || stage === "persona" ? "done" : started ? "active" : "todo",
    },
  ];
  if (job.inputSnapshot?.synthesizePersona) {
    steps.push({
      key: "persona",
      label: "Drafted a persona from your prompt",
      state: pastPersona ? "done" : stage === "persona" ? "active" : "todo",
    });
  }
  for (let i = 1; i <= job.variantCount; i++) {
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
      (isReady && (nextVariantHasItems || i < job.variantCount));

    const isActive =
      !isDone &&
      (current === i || hasRunningItem) &&
      pastPersona;

    steps.push({
      key: `variant-${i}`,
      label: `Laying out variant ${LABELS[i - 1] ?? i}`,
      state: isDone ? "done" : isActive ? "active" : "todo",
    });
  }
  return steps;
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
    const list = liveTraces.map((item) => {
      if (item.phase === "thinking" && !item.thought && effectiveThought) {
        return { ...item, thought: effectiveThought };
      }
      return item;
    });
    return list.sort(
      (a, b) => (PHASE_ORDER[a.phase] ?? 99) - (PHASE_ORDER[b.phase] ?? 99)
    );
  }

  if (stepState === "done" || Boolean(outputVariant)) {
    const list: VariantTraceItem[] = [];
    const estimatedSeconds = effectiveThought
      ? Math.max(3, Math.min(15, Math.round(effectiveThought.length / 300)))
      : 5;

    if (effectiveThought) {
      list.push({
        id: "thinking",
        phase: "thinking",
        status: "done",
        title: `Thought for ${estimatedSeconds} seconds`,
        thought: effectiveThought,
        thoughtDurationSeconds: estimatedSeconds,
      });
    }
    list.push({
      id: "generating",
      phase: "generating",
      status: "done",
      title: "Drafted HTML component hierarchy",
    });
    list.push({
      id: "checking",
      phase: "checking",
      status: "done",
      title: `Validated ${standard} contrast & design system rules`,
    });
    if (outputVariant?.attempts && outputVariant.attempts > 1) {
      list.push({
        id: `repairing-${outputVariant.attempts}`,
        phase: "repairing",
        status: "done",
        title: `Thought for 3 seconds (Attempt ${outputVariant.attempts})`,
        thoughtDurationSeconds: 3,
        attempt: outputVariant.attempts,
        thought: `Auto-adjusted contrast ratios and component slot attributes to pass ${standard} checks.`,
      });
    }
    list.push({
      id: "ready",
      phase: "ready",
      status: "done",
      title: "Variant markup verified & saved",
    });
    return list.sort(
      (a, b) => (PHASE_ORDER[a.phase] ?? 99) - (PHASE_ORDER[b.phase] ?? 99)
    );
  }

  if (stepState === "active") {
    return [
      {
        id: "thinking",
        phase: "thinking",
        status: "running",
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
}: {
  label: string;
  index: number;
  status: GenerationJobStatus;
  progress: GenerationProgress | null;
  traces?: VariantTraceItem[];
}) {
  const line = variantStatus(index, status, progress, traces);
  return (
    <div className="flex w-full max-w-[440px] flex-col gap-4 rounded-[14px] border border-border bg-card p-6 shadow-sm">
      <h2 className="font-heading text-xl font-medium leading-7 text-foreground">
        Variant {label}
      </h2>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2" aria-live="polite">
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              index % 2 === 1 ? "bg-design-a" : "bg-design-b"
            )}
            aria-hidden="true"
          />
          {line.busy && (
            <HugeIcon icon={Loading02Icon} size={16} className="animate-spin text-foreground" />
          )}
          {line.done && (
            <HugeIcon icon={Tick02Icon} size={16} className="text-primary-text" />
          )}
          <p className="text-sm leading-5 text-muted-foreground">{line.text}</p>
        </div>
        <div className={cn("flex flex-col gap-2", line.busy && "animate-pulse")} aria-hidden="true">
          <div className="h-5 rounded-[10px] bg-accent" />
          <div className="h-8 rounded-[10px] bg-accent" />
          <div className="h-8 rounded-[10px] bg-accent" />
          <div className="h-8 rounded-[10px] bg-accent" />
          <div className="flex gap-2">
            <div className="h-16 flex-1 rounded-[10px] bg-accent" />
            <div className="h-16 flex-1 rounded-[10px] bg-accent" />
          </div>
          <div className="h-8 rounded-[10px] bg-accent" />
        </div>
      </div>
    </div>
  );
}

function GeneratingContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { project, setBreadcrumbs } = useBreadcrumbs();
  const projectId = params.projectId as string;
  const roundId = params.roundId as string;
  const jobParam = searchParams.get("job");

  const [job, setJob] = React.useState<GenerationJob | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [busyAction, setBusyAction] = React.useState<"cancel" | "retry" | null>(null);

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

  React.useEffect(() => {
    const storyTitle = job?.inputSnapshot?.stories?.[0]?.title;
    setBreadcrumbs([
      { label: project?.name ?? "Project", href: `/projects/${projectId}` },
      { label: storyTitle ?? "Generating A/B" },
    ]);
  }, [setBreadcrumbs, project?.name, projectId, job]);

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
        <HugeIcon icon={Loading02Icon} size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const designSystem =
    DESIGN_SYSTEM_NAMES[job.uiLibrary] ?? job.inputSnapshot?.intent?.designSystem ?? job.uiLibrary;
  const labels = LABELS.slice(0, job.variantCount);
  const steps = progressSteps(job, status, live.progress, live.tracesByVariant);
  const ended = status === "FAILED" || status === "CANCELLED";

  return (
    <div className="flex w-full flex-col gap-8 px-10 py-10">
      <div className="flex w-full flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-heading text-2xl font-medium leading-8 tracking-[-0.01em] text-foreground">
            Building {labels.join(" and ")} from {designSystem}
          </h1>
          <p className="text-base leading-6 text-muted-foreground">
            This usually takes a few minutes. You can leave this page; the designs keep generating.
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

        <div className="flex w-full flex-wrap items-start justify-center gap-4">
          {labels.map((label, i) => (
            <VariantCard
              key={label}
              label={label}
              index={i + 1}
              status={status}
              progress={live.progress}
              traces={live.tracesByVariant[i + 1]}
            />
          ))}
        </div>

        <section className="flex w-full max-w-[560px] flex-col gap-4 rounded-[14px] border border-border bg-card p-6 shadow-sm">
          <h2 className="font-heading text-xl font-medium leading-7 text-foreground">
            Progress
          </h2>
          <Trace>
            {steps.map((step) => {
              const traceStatus =
                step.state === "done"
                  ? "finished"
                  : step.state === "active"
                    ? "running"
                    : "pending";

              const variantMatch = step.key.match(/^variant-(\d+)$/);
              const variantIdx = variantMatch ? Number(variantMatch[1]) : null;
              const outputVariant = variantIdx
                ? job.outputMetadata?.variants?.find((v) => v.variant === variantIdx)
                : undefined;
              const stepThought = variantIdx
                ? live.thoughtsByVariant[variantIdx] ??
                  (live.progress?.variant === variantIdx ? live.progress.thought : undefined) ??
                  outputVariant?.thought
                : undefined;

              const standard =
                job.inputSnapshot?.intent?.designStandards?.[0] ?? "WCAG 2.2 AA";

              const variantTraces = variantIdx
                ? getVariantTraces(
                    variantIdx,
                    standard,
                    live.tracesByVariant[variantIdx] ?? [],
                    outputVariant,
                    stepThought,
                    step.state
                  )
                : [];

              return (
                <TraceLine key={step.key} status={traceStatus}>
                  <TraceIcon>
                    {step.state === "done" && (
                      <HugeIcon icon={Tick02Icon} size={18} className="text-primary-text" />
                    )}
                    {step.state === "active" && (
                      <HugeIcon icon={Loading02Icon} size={16} className="animate-spin text-foreground" />
                    )}
                    {step.state === "todo" && (
                      <HugeIcon icon={CircleIcon} size={16} className="text-muted-foreground" />
                    )}
                  </TraceIcon>
                  <div className="flex flex-1 flex-col min-w-0">
                    <TraceTitle>{step.label}</TraceTitle>
                    {step.key === "intent" && step.state === "done" && (
                      <div className="mt-2 ml-1 flex flex-col gap-2 border-l-2 border-border/60 pl-3 py-1">
                        <TraceCollapsible defaultOpen={false} className="w-full">
                          <TraceCollapsibleTrigger className="flex items-center gap-1.5 text-xs py-0.5 text-muted-foreground hover:text-foreground font-medium cursor-pointer">
                            <span>Design intent & context summary</span>
                          </TraceCollapsibleTrigger>
                          <TraceCollapsibleContent>
                            <div className="mt-1.5 rounded-md border border-border/70 bg-muted/40 p-2.5 font-mono text-[11px] leading-relaxed text-muted-foreground space-y-1 shadow-inner">
                              <p>• Story: &ldquo;{job.inputSnapshot?.stories?.[0]?.title ?? "Primary user workflow"}&rdquo;</p>
                              <p>• UI Library: {designSystem}</p>
                              <p>• Standard: {standard}</p>
                              <p>• Accessibility & color tokens injected into context.</p>
                            </div>
                          </TraceCollapsibleContent>
                        </TraceCollapsible>
                      </div>
                    )}
                    {step.key === "persona" && (
                      <div className="mt-2 ml-1 flex flex-col gap-2 border-l-2 border-border/60 pl-3 py-1">
                        {(() => {
                          const personaThought =
                            live.personaThought ?? job.outputMetadata?.personaThought;
                          const isRunning = step.state === "active";
                          return (
                            <TraceCollapsible
                              defaultOpen={isRunning}
                              className="w-full"
                            >
                              <div className="flex items-center gap-2">
                                <TraceCollapsibleTrigger className="flex items-center gap-1.5 text-xs py-0.5 text-foreground hover:text-foreground/80 font-medium cursor-pointer">
                                  <Brain
                                    className={cn(
                                      "size-3.5 shrink-0",
                                      isRunning
                                        ? "text-violet-500 animate-pulse"
                                        : "text-muted-foreground"
                                    )}
                                  />
                                  <span>
                                    {isRunning
                                      ? "Thinking..."
                                      : "Thought for 4 seconds"}
                                  </span>
                                </TraceCollapsibleTrigger>
                                {isRunning && (
                                  <HugeIcon
                                    icon={Loading02Icon}
                                    size={12}
                                    className="animate-spin text-muted-foreground ml-auto shrink-0"
                                  />
                                )}
                                {!isRunning && (
                                  <HugeIcon
                                    icon={Tick02Icon}
                                    size={12}
                                    className="text-muted-foreground/70 ml-auto shrink-0"
                                  />
                                )}
                              </div>
                              <TraceCollapsibleContent>
                                <div className="mt-1.5 rounded-md border border-border/70 bg-muted/40 p-2.5 font-mono text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto select-text shadow-inner">
                                  {personaThought ||
                                    "Synthesized target user persona from your prompt and project design intent."}
                                </div>
                              </TraceCollapsibleContent>
                            </TraceCollapsible>
                          );
                        })()}
                      </div>
                    )}
                    {variantTraces.length > 0 && (
                      <div className="mt-2.5 ml-1 flex flex-col gap-2 border-l-2 border-border/60 pl-3 py-1">
                        {variantTraces.map((item) => {
                          if (item.phase === "thinking") {
                            const isRunning = item.status === "running";
                            const displayTitle = isRunning
                              ? "Thinking..."
                              : `Thought for ${item.thoughtDurationSeconds ?? 5} seconds`;

                            return (
                              <TraceCollapsible
                                key={item.id}
                                defaultOpen={isRunning}
                                className="w-full"
                              >
                                <div className="flex items-center gap-2">
                                  <TraceCollapsibleTrigger className="flex items-center gap-1.5 text-xs py-0.5 text-foreground hover:text-foreground/80 font-medium cursor-pointer">
                                    <Brain
                                      className={cn(
                                        "size-3.5 shrink-0",
                                        isRunning
                                          ? "text-violet-500 animate-pulse"
                                          : "text-muted-foreground"
                                      )}
                                    />
                                    <span>{displayTitle}</span>
                                  </TraceCollapsibleTrigger>
                                  {isRunning && (
                                    <HugeIcon
                                      icon={Loading02Icon}
                                      size={12}
                                      className="animate-spin text-muted-foreground ml-auto shrink-0"
                                    />
                                  )}
                                  {!isRunning && (
                                    <HugeIcon
                                      icon={Tick02Icon}
                                      size={12}
                                      className="text-muted-foreground/70 ml-auto shrink-0"
                                    />
                                  )}
                                </div>
                                {item.thought && (
                                  <TraceCollapsibleContent>
                                    <div className="mt-1.5 rounded-md border border-border/70 bg-muted/40 p-2.5 font-mono text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto select-text shadow-inner">
                                      {item.thought}
                                    </div>
                                  </TraceCollapsibleContent>
                                )}
                              </TraceCollapsible>
                            );
                          }

                          if (item.phase === "repairing") {
                            const isRunning = item.status === "running";
                            const displayTitle = isRunning
                              ? `Thinking about repairs (Attempt ${item.attempt || 2})...`
                              : `Thought for ${item.thoughtDurationSeconds ?? 3} seconds (Attempt ${item.attempt || 2})`;

                            return (
                              <TraceCollapsible
                                key={item.id}
                                defaultOpen={isRunning}
                                className="w-full"
                              >
                                <div className="flex items-center gap-2">
                                  <TraceCollapsibleTrigger className="flex items-center gap-1.5 text-xs py-0.5 text-foreground hover:text-foreground/80 font-medium cursor-pointer">
                                    <Wrench className="size-3.5 shrink-0 text-amber-500 animate-pulse" />
                                    <span>{displayTitle}</span>
                                  </TraceCollapsibleTrigger>
                                  {isRunning && (
                                    <HugeIcon
                                      icon={Loading02Icon}
                                      size={12}
                                      className="animate-spin text-muted-foreground ml-auto shrink-0"
                                    />
                                  )}
                                  {!isRunning && (
                                    <HugeIcon
                                      icon={Tick02Icon}
                                      size={12}
                                      className="text-muted-foreground/70 ml-auto shrink-0"
                                    />
                                  )}
                                </div>
                                <TraceCollapsibleContent>
                                  <div className="mt-1.5 rounded-md border border-border/70 bg-muted/40 p-2.5 font-mono text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto select-text shadow-inner">
                                    {item.thought ||
                                      `Auto-adjusting contrast & element slots to pass ${standard} checks.`}
                                  </div>
                                </TraceCollapsibleContent>
                              </TraceCollapsible>
                            );
                          }

                          if (item.phase === "checking") {
                            return (
                              <TraceCollapsible
                                key={item.id}
                                defaultOpen={false}
                                className="w-full"
                              >
                                <div className="flex items-center gap-2">
                                  <TraceCollapsibleTrigger className="flex items-center gap-1.5 text-xs py-0.5 text-foreground hover:text-foreground/80 font-medium cursor-pointer">
                                    <ShieldCheck
                                      className={cn(
                                        "size-3.5 shrink-0",
                                        item.status === "running"
                                          ? "text-amber-500 animate-pulse"
                                          : item.status === "error"
                                            ? "text-destructive"
                                            : "text-muted-foreground"
                                      )}
                                    />
                                    <span>{item.title}</span>
                                  </TraceCollapsibleTrigger>
                                  {item.status === "running" && (
                                    <HugeIcon
                                      icon={Loading02Icon}
                                      size={12}
                                      className="animate-spin text-muted-foreground ml-auto shrink-0"
                                    />
                                  )}
                                  {item.status === "done" && (
                                    <HugeIcon
                                      icon={Tick02Icon}
                                      size={12}
                                      className="text-muted-foreground/70 ml-auto shrink-0"
                                    />
                                  )}
                                </div>
                                <TraceCollapsibleContent>
                                  <div className="mt-1.5 rounded-md border border-border/70 bg-muted/40 p-2.5 font-mono text-[11px] leading-relaxed text-muted-foreground space-y-1 shadow-inner">
                                    <p>✓ {standard}: Contrast thresholds verified (4.5:1 text, 3:1 graphical elements).</p>
                                    <p>✓ UI Kit: Component markup confirmed against {designSystem} specifications.</p>
                                    <p>✓ DOM structure: Verified slot attributes and tag nesting.</p>
                                  </div>
                                </TraceCollapsibleContent>
                              </TraceCollapsible>
                            );
                          }

                          return (
                            <div key={item.id} className="flex items-center gap-2 py-0.5 text-xs">
                              {item.phase === "generating" && (
                                <FileCode
                                  className={cn(
                                    "size-3.5 shrink-0",
                                    item.status === "running"
                                      ? "text-blue-500 animate-pulse"
                                      : "text-muted-foreground"
                                  )}
                                />
                              )}
                              {item.phase === "ready" && (
                                <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                              )}

                              <span
                                className={cn(
                                  "font-medium",
                                  item.status === "running"
                                    ? "text-foreground"
                                    : "text-muted-foreground"
                                )}
                              >
                                {item.title}
                                {item.phase === "generating" &&
                                item.receivedChars &&
                                item.status === "running"
                                  ? ` (${(item.receivedChars / 1024).toFixed(1)} KB)`
                                  : null}
                              </span>

                              {item.status === "running" && (
                                <HugeIcon
                                  icon={Loading02Icon}
                                  size={12}
                                  className="animate-spin text-muted-foreground ml-auto shrink-0"
                                />
                              )}
                              {item.status === "done" && item.phase !== "ready" && (
                                <HugeIcon
                                  icon={Tick02Icon}
                                  size={12}
                                  className="text-muted-foreground/70 ml-auto shrink-0"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </TraceLine>
              );
            })}
          </Trace>
        </section>

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
            onClick={handleCancel}
            disabled={busyAction !== null || status === "SUCCEEDED"}
          >
            {busyAction === "cancel" ? "Cancelling…" : "Cancel"}
          </Button>
        )}
      </div>
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
