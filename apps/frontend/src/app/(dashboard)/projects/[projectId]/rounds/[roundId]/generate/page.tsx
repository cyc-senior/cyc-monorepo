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
import { Trace, TraceLine, TraceIcon, TraceTitle } from "@/components/ui/trace";
import { useBreadcrumbs } from "@/contexts/breadcrumb-context";
import { useJobStream } from "@/components/generation/use-job-stream";
import {
  cancelGenerationJob,
  GenerationJob,
  GenerationJobStatus,
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
  progress: GenerationProgress | null
): { text: string; busy: boolean; done: boolean } {
  if (status === "SUCCEEDED") return { text: "Ready", busy: false, done: true };
  if (status === "FAILED") return { text: "Failed", busy: false, done: false };
  if (status === "CANCELLED")
    return { text: "Cancelled", busy: false, done: false };
  if (!progress || status === "QUEUED")
    return { text: "Waiting", busy: false, done: false };
  if (progress.stage === "saving")
    return { text: "Saving…", busy: true, done: false };
  const current = progress.variant ?? 0;
  if (current > index) return { text: "Done", busy: false, done: true };
  if (current < index) {
    const starting =
      index === 1 && (progress.stage === "started" || progress.stage === "persona");
    return starting
      ? { text: "Reading your intent…", busy: true, done: false }
      : { text: "Waiting", busy: false, done: false };
  }
  switch (progress.stage) {
    case "checking":
      return { text: "Checking accessibility…", busy: true, done: false };
    case "repairing":
      return {
        text: `Fixing ${progress.errors ?? "a few"} issue${progress.errors === 1 ? "" : "s"}…`,
        busy: true,
        done: false,
      };
    default:
      return { text: "Laying out…", busy: true, done: false };
  }
}

/** The checklist under the cards, from the job's live progress. */
function progressSteps(
  job: GenerationJob,
  status: GenerationJobStatus,
  progress: GenerationProgress | null
): Step[] {
  const finished = status === "SUCCEEDED";
  const stage = progress?.stage;
  const current = progress?.variant ?? 0;
  const started = status === "RUNNING" || finished || Boolean(progress);
  const pastPersona = finished || (stage !== undefined && stage !== "started" && stage !== "persona");
  const standard =
    job.inputSnapshot?.intent?.designStandards?.[0] ?? "WCAG AA";
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
    steps.push({
      key: `variant-${i}`,
      label: `Laying out variant ${LABELS[i - 1] ?? i}`,
      state:
        finished || stage === "saving" || current > i
          ? "done"
          : current === i && pastPersona
            ? "active"
            : "todo",
    });
  }
  steps.push({
    key: "check",
    label: `Checking ${standard} contrast`,
    state:
      finished || stage === "saving"
        ? "done"
        : stage === "checking" || stage === "repairing"
          ? "active"
          : "todo",
  });
  return steps;
}

function VariantCard({
  label,
  index,
  status,
  progress,
}: {
  label: string;
  index: number;
  status: GenerationJobStatus;
  progress: GenerationProgress | null;
}) {
  const line = variantStatus(index, status, progress);
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
    }
  }, [status, router, projectId, roundId]);

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
      router.push(`/projects/${projectId}`);
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
  const steps = progressSteps(job, status, live.progress);
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
                  <TraceTitle>{step.label}</TraceTitle>
                </TraceLine>
              );
            })}
          </Trace>
        </section>

        {ended ? (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => router.push(`/projects/${projectId}`)}>
              Back to project
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
