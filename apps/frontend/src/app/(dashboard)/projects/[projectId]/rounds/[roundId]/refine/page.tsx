"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { HugeIcon } from "@/components/ui/huge-icon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Alert02Icon,
  ArrowRight02Icon,
  Clock01Icon,
  Comment01Icon,
  ComputerIcon,
  DashboardSquare01Icon,
  Loading02Icon,
  SmartPhone01Icon,
  SourceCodeIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { useBreadcrumbs } from "@/contexts/breadcrumb-context";
import { useSidebarMode } from "@/contexts/sidebar-context";
import { useJobStream } from "@/components/generation/use-job-stream";
import {
  DEFAULT_VIEWPORT,
  isMobileViewport,
  MOBILE_PRESET,
  PreviewCanvas,
  RESPONSIVE,
  Selection,
  ViewportState,
} from "@/components/generation/PreviewCanvas";
import {
  ChatMessage,
  ChatPanel,
  CodeBlock,
  CodeEmptyState,
  ComponentsBento,
  VersionsPanel,
} from "@/components/generation/RefinePanels";
import {
  DesignComponent,
  extractComponents,
} from "@/components/generation/html-components";
import {
  buildVersions,
  decodeRefinePrompt,
  DesignVersion,
  encodeBatchRefinePrompt,
  findVersion,
  PickedElement,
  PinnedComment,
  versionName,
  versionSummary,
} from "@/components/generation/versions";
import {
  approveVariant,
  GenerationJob,
  GenerationProgress,
  listRoundJobs,
  listRoundVariants,
  restoreVariant,
  startRefinement,
  generateMore,
  UIVariant,
} from "@/lib/generation-client";

const ACTIVE = new Set(["QUEUED", "RUNNING"]);

/** Active tab look from Figma: lime text and underline. */
const TAB_TRIGGER =
  "h-[25px] gap-1.5 px-2.5 pb-1 data-[state=active]:border-primary-text data-[state=active]:text-primary-text";

function stageText(
  progress: GenerationProgress | null,
  label: string,
  /** A design built from scratch, not a new version of one. */
  building = false
): string {
  switch (progress?.stage) {
    case "generating":
      return building ? `Building ${label}…` : `Working on a new version of ${label}…`;
    case "checking":
      return "Checking accessibility…";
    case "repairing":
      return `Fixing ${progress.errors ?? "a few"} issue${progress.errors === 1 ? "" : "s"}…`;
    case "saving":
      return "Saving the new version…";
    default:
      return "Queued…";
  }
}

const LETTERS = ["A", "B", "C", "D"];

/** Why the designs of a job did not pass, from its check report. */
function failureReason(job: GenerationJob): string | null {
  const issue = job.outputMetadata?.variants?.find((v) => !v.passed)?.issues?.[0];
  if (!issue) return job.error;
  return `${issue.criterion ? `WCAG ${issue.criterion}: ` : ""}${issue.message.split(". Fix:")[0]}`;
}

/** The conversation, rebuilt from the round's generation jobs. */
function buildMessages(
  jobs: GenerationJob[],
  lines: ReturnType<typeof buildVersions>,
  liveJobId: string | null,
  liveProgress: GenerationProgress | null
): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const builds = jobs.filter((j) => !j.baseVariantId);
  const first = builds[0];
  // Designs the first build was asked for that no build has produced yet.
  const missing = first
    ? LETTERS.slice(0, first.variantCount).filter((label) => !lines[label])
    : [];
  const lastBuild = builds.at(-1);

  for (const job of jobs) {
    const base = findVersion(lines, job.baseVariantId);
    if (!job.baseVariantId) {
      const made = job.variantIds
        .map((id) => findVersion(lines, id))
        .filter((v): v is DesignVersion => Boolean(v))
        .map((v) => `${versionName(v)} (${v.variant.name})`);
      const isFirst = job === first;
      if (!isFirst) {
        messages.push({
          id: `${job.id}-you`,
          role: "you",
          text: `Generate ${job.variantCount === 1 ? "the missing design" : `${job.variantCount} designs`} again.`,
        });
      }
      let text: string | null = null;
      let pending = false;
      if (job.status === "SUCCEEDED" && made.length) {
        text = `${made.join(" and ")} ${made.length > 1 ? "are" : "is"} ready.${isFirst ? " Tell me what to change, or pick an element in the preview." : ""}`;
      } else if (job.status === "QUEUED" || job.status === "RUNNING") {
        pending = true;
        text = stageText(
          job.id === liveJobId ? liveProgress : null,
          missing.join(" and ") || "the design",
          true
        );
      } else if (job.status === "CANCELLED") {
        text = "Cancelled.";
      }
      // After the latest build, say what is still missing and offer to retry;
      // a failed earlier build just says why.
      const reason = failureReason(job);
      if (job === lastBuild && !pending && missing.length > 0) {
        text = `${text ? `${text} ` : ""}${missing.join(" and ")} couldn't pass the design system and accessibility checks${reason ? ` (${reason})` : ""}.`;
      } else if (job.status === "FAILED") {
        text = `No design passed the checks this time${reason ? ` (${reason})` : ""}.`;
      }
      if (text) {
        messages.push({
          id: `${job.id}-ai`,
          role: "ai",
          pending,
          text,
          action:
            job === lastBuild && !pending && missing.length > 0
              ? { id: "regenerate", label: `Generate ${missing.join(" and ")} again` }
              : undefined,
        });
      }
      continue;
    }
    const { text, elementKind } = decodeRefinePrompt(job.prompt ?? "");
    messages.push({ id: `${job.id}-you`, role: "you", text, elementKind });

    const label = base?.label ?? "the design";
    if (job.status === "SUCCEEDED") {
      const made = findVersion(lines, job.variantIds[0]);
      const rationale = job.outputMetadata?.variants?.find((v) => v.passed)?.rationale;
      messages.push({
        id: `${job.id}-ai`,
        role: "ai",
        text: `Done in ${made ? versionName(made) : "a new version"}. ${rationale ?? ""}`.trim(),
      });
    } else if (job.status === "FAILED") {
      messages.push({
        id: `${job.id}-ai`,
        role: "ai",
        text: `I couldn't make that change: ${failureReason(job) ?? "the design did not pass its checks"}. ${label} is unchanged.`,
      });
    } else if (job.status === "CANCELLED") {
      messages.push({ id: `${job.id}-ai`, role: "ai", text: "Cancelled. Nothing was changed." });
    } else {
      messages.push({
        id: `${job.id}-ai`,
        role: "ai",
        pending: true,
        text: stageText(job.id === liveJobId ? liveProgress : null, label),
      });
    }
  }
  return messages;
}

function RefineContent() {
  const params = useParams();
  const router = useRouter();
  const { project, setBreadcrumbs } = useBreadcrumbs();
  useSidebarMode("rail");
  const projectId = params.projectId as string;
  const roundId = params.roundId as string;

  const [variants, setVariants] = React.useState<UIVariant[]>([]);
  const [jobs, setJobs] = React.useState<GenerationJob[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [labelChoice, setLabel] = React.useState("A");
  const [previewed, setPreviewed] = React.useState<Record<string, string | undefined>>({});
  const [leftTab, setLeftTab] = React.useState("chat");
  const [rightTab, setRightTab] = React.useState("preview");
  const [viewport, setViewport] = React.useState<ViewportState>(DEFAULT_VIEWPORT);
  const [pickMode, setPickMode] = React.useState(false);
  const [picked, setPicked] = React.useState<{ element: PickedElement; selection: Selection } | null>(null);
  const [pinsByVariant, setPinsByVariant] = React.useState<Record<string, PinnedComment[]>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem(`refine_pins:${roundId}`);
      return raw ? (JSON.parse(raw) as Record<string, PinnedComment[]>) : {};
    } catch {
      return {};
    }
  });
  React.useEffect(() => {
    try {
      localStorage.setItem(`refine_pins:${roundId}`, JSON.stringify(pinsByVariant));
    } catch {}
  }, [roundId, pinsByVariant]);
  const [componentId, setComponentId] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [restoringId, setRestoringId] = React.useState<string | null>(null);
  const [approving, setApproving] = React.useState(false);

  const fetchRound = React.useCallback(
    () =>
      Promise.all([
        listRoundVariants(projectId, roundId),
        listRoundJobs(projectId, roundId),
      ]),
    [projectId, roundId]
  );

  const load = React.useCallback(async () => {
    const [v, j] = await fetchRound();
    setVariants(v);
    setJobs(j);
  }, [fetchRound]);

  React.useEffect(() => {
    let active = true;
    fetchRound()
      .then(([v, j]) => {
        if (!active) return;
        setVariants(v);
        setJobs(j);
        setLoading(false);
        // Still on the first build: show its progress instead.
        const building = j.find((job) => !job.baseVariantId && ACTIVE.has(job.status));
        if (v.length === 0 && building) {
          router.replace(`/projects/${projectId}/rounds/${roundId}/generate?job=${building.id}`);
        }
      })
      .catch(() => {
        if (!active) return;
        setError("Couldn't load the designs of this round.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchRound, router, projectId, roundId]);

  // A refinement in progress (also one started before this page was opened).
  // Any generation in progress: a refinement, or a design generated again.
  const activeJob = jobs.find((j) => ACTIVE.has(j.status)) ?? null;
  const live = useJobStream(projectId, activeJob?.id ?? null);
  const liveStatus = live.snapshot?.status;

  const settledJob = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!activeJob || !liveStatus || ACTIVE.has(liveStatus)) return;
    if (settledJob.current === activeJob.id) return;
    settledJob.current = activeJob.id;
    // The refinement finished: show the newest version (or keep the old one if it failed).
    void load().then(() => setPreviewed({}));
  }, [activeJob, liveStatus, load]);

  const lines = React.useMemo(() => buildVersions(variants), [variants]);
  const labels = React.useMemo(() => Object.keys(lines).sort(), [lines]);
  // The chosen design, or the first one if the round has no such label.
  const label = lines[labelChoice] ? labelChoice : (labels[0] ?? labelChoice);
  const line = lines[label] ?? [];
  const current = line.at(-1);
  const shown = findVersion(lines, previewed[label]) ?? current;
  const shownIndex = shown ? line.indexOf(shown) : -1;

  React.useEffect(() => {
    const storyTitle = jobs[0]?.inputSnapshot?.stories?.[0]?.title;
    setBreadcrumbs([
      { label: project?.name ?? "Project", href: `/projects/${projectId}` },
      { label: storyTitle ?? "Refine A/B" },
    ]);
  }, [setBreadcrumbs, project?.name, projectId, jobs]);

  const shownHtml = shown?.variant.html ?? null;
  const components = React.useMemo<DesignComponent[]>(
    () => (rightTab === "components" && shownHtml ? extractComponents(shownHtml) : []),
    [rightTab, shownHtml]
  );
  const selectedComponent = components.find((c) => c.id === componentId) ?? null;

  const messages = React.useMemo(
    () => buildMessages(jobs, lines, activeJob?.id ?? null, live.progress),
    [jobs, lines, activeJob?.id, live.progress]
  );

  const allVersions = React.useMemo(
    () =>
      labels.flatMap((l) => [...lines[l]].reverse()),
    [labels, lines]
  );
  const summaries = React.useMemo(
    () => Object.fromEntries(allVersions.map((v) => [v.variant.id, versionSummary(v, jobs)])),
    [allVersions, jobs]
  );

  const showVersion = (version: DesignVersion) => {
    setLabel(version.label);
    setPreviewed((prev) => ({ ...prev, [version.label]: version.variant.id }));
    setPicked(null);
    setComponentId(null);
  };

  const switchLabel = (next: string) => {
    setLabel(next);
    setPicked(null);
    setPickMode(false);
    setComponentId(null);
  };

  const handlePick = React.useCallback((element: PickedElement, selection: Selection) => {
    setPicked({ element, selection });
    setPickMode(false);
    setLeftTab("chat");
  }, []);

  /** "Generate B again": the first build's prompt and stories, for the missing designs. */
  const handleAction = async (actionId: string) => {
    if (actionId !== "regenerate") return;
    const first = jobs.find((j) => !j.baseVariantId);
    if (!first) return;
    const missing = ["A", "B", "C", "D"].slice(0, first.variantCount).filter((l) => !lines[l]);
    if (missing.length === 0) return;
    setSending(true);
    setError(null);
    try {
      const job = await generateMore(projectId, roundId, {
        prompt: first.prompt ?? first.inputSnapshot?.prompt ?? "",
        variantCount: missing.length,
        storyIds: first.inputSnapshot?.stories?.map((s) => s.id),
      });
      setJobs((prev) => [...prev, job]);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "Couldn't start the generation. Try again.");
    } finally {
      setSending(false);
    }
  };

  const shownVariantId = shown?.variant.id ?? "";
  const currentPins = React.useMemo(
    () => (shownVariantId ? (pinsByVariant[shownVariantId] ?? []) : []),
    [pinsByVariant, shownVariantId]
  );

  const handlePinPicked = React.useCallback(
    (comment: string) => {
      if (!picked || !shownVariantId) return;
      const pin: PinnedComment = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        element: picked.element,
        comment,
      };
      setPinsByVariant((prev) => ({
        ...prev,
        [shownVariantId]: [...(prev[shownVariantId] ?? []), pin],
      }));
      setPicked(null);
      setPickMode(true);
    },
    [picked, shownVariantId]
  );

  const handleRemovePin = React.useCallback(
    (pinId: string) => {
      if (!shownVariantId) return;
      setPinsByVariant((prev) => ({
        ...prev,
        [shownVariantId]: (prev[shownVariantId] ?? []).filter((p) => p.id !== pinId),
      }));
    },
    [shownVariantId]
  );

  const handleSend = async (text: string): Promise<boolean> => {
    if (!shown) return false;
    setSending(true);
    setError(null);
    try {
      const job = await startRefinement(projectId, roundId, {
        prompt: encodeBatchRefinePrompt(text, picked?.element ?? null, currentPins),
        baseVariantId: shown.variant.id,
        storyIds: shown.variant.storyIds,
      });
      setJobs((prev) => [...prev, job]);
      setPicked(null);
      setPickMode(false);
      setPinsByVariant((prev) => {
        const next = { ...prev };
        delete next[shown.variant.id];
        return next;
      });
      return true;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "Couldn't send the change. Try again.");
      return false;
    } finally {
      setSending(false);
    }
  };

  const handleRestore = async (version: DesignVersion) => {
    const head = lines[version.label]?.at(-1);
    if (!head) return;
    setRestoringId(version.variant.id);
    setError(null);
    try {
      const restored = await restoreVariant(projectId, version.variant, head.variant);
      await load();
      setLabel(version.label);
      setPreviewed((prev) => ({ ...prev, [version.label]: restored.id }));
    } catch {
      setError(`Couldn't restore ${versionName(version)}.`);
    } finally {
      setRestoringId(null);
    }
  };

  const handleReadyToTest = async () => {
    setApproving(true);
    setError(null);
    try {
      for (const l of labels) {
        const head = lines[l].at(-1);
        if (head && head.variant.status !== "APPROVED") {
          await approveVariant(projectId, head.variant.id);
        }
      }
      router.push(`/projects/${projectId}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "Couldn't approve the designs for testing.");
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex w-full justify-center py-24">
        <HugeIcon icon={Loading02Icon} size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!shown) {
    return (
      <div className="flex w-full flex-col items-center gap-4 px-10 py-24 text-center">
        <p className="text-muted-foreground">{error ?? "No designs to refine in this round yet."}</p>
        <Button asChild variant="outline">
          <Link href={`/projects/${projectId}`}>Back to project</Link>
        </Button>
      </div>
    );
  }

  const mobile = isMobileViewport(viewport);

  return (
    // Screen 18F: flush, full-height panels under the header; only the chat
    // list and the canvas scroll, never the page.
    <div className="flex min-h-full w-full flex-col lg:h-full">
      {error && (
        <Alert variant="destructive" className="m-4 mb-0 w-auto">
          <HugeIcon icon={Alert02Icon} size={16} />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex min-h-0 w-full flex-1 flex-col items-stretch lg:flex-row">
        {/* Refine panel: fixed 640px chat column */}
        <section className="flex min-h-[560px] w-full shrink-0 flex-col gap-4 border-b border-border bg-background px-6 pt-4 pb-4 lg:min-h-0 lg:w-[640px] lg:border-r lg:border-b-0">
          {rightTab === "components" ? (
            <Tabs value="code" className="flex min-h-0 flex-1 flex-col gap-4">
              <TabsList variant="line" className="w-auto gap-0 border-b-0">
                <TabsTrigger value="code" className={TAB_TRIGGER}>
                  <HugeIcon icon={SourceCodeIcon} size={16} />
                  Code
                </TabsTrigger>
              </TabsList>
              <TabsContent value="code" className="flex min-h-0 flex-col gap-3">
                {selectedComponent ? (
                  <>
                    <CodeBlock component={selectedComponent} />
                    <p className="text-sm leading-5 text-muted-foreground">
                      Pick another component to see its code.
                    </p>
                  </>
                ) : (
                  <CodeEmptyState />
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <Tabs
              value={leftTab}
              onValueChange={setLeftTab}
              className="flex min-h-0 flex-1 flex-col gap-4"
            >
              <TabsList variant="line" className="w-auto gap-0 border-b-0">
                <TabsTrigger value="chat" className={TAB_TRIGGER}>
                  <HugeIcon icon={Comment01Icon} size={16} />
                  Chat
                </TabsTrigger>
                <TabsTrigger value="versions" className={TAB_TRIGGER}>
                  <HugeIcon icon={Clock01Icon} size={16} />
                  Versions
                </TabsTrigger>
              </TabsList>
              <TabsContent value="chat" className="flex min-h-0 flex-col">
                <ChatPanel
                  messages={messages}
                  label={label}
                  picked={picked?.element ?? null}
                  pins={currentPins}
                  pickMode={pickMode}
                  onTogglePick={() => {
                    setPickMode((on) => !on);
                    setRightTab("preview");
                  }}
                  onClearPicked={() => setPicked(null)}
                  onPinPicked={handlePinPicked}
                  onRemovePin={handleRemovePin}
                  onSend={handleSend}
                  onAction={handleAction}
                  sending={sending}
                  disabled={Boolean(activeJob)}
                />
              </TabsContent>
              <TabsContent value="versions" className="flex min-h-0 flex-col">
                <VersionsPanel
                  versions={allVersions}
                  summaries={summaries}
                  previewedId={shown.variant.id}
                  restoringId={restoringId}
                  onPreview={showVersion}
                  onRestore={handleRestore}
                />
              </TabsContent>
            </Tabs>
          )}
        </section>

        {/* Canvas column */}
        <section className="flex min-h-[640px] min-w-0 flex-1 flex-col gap-4 bg-background px-4 pt-4 pb-4 lg:min-h-0">
          <Tabs value={rightTab} onValueChange={setRightTab} className="flex min-h-0 flex-1 flex-col gap-4">
            <TabsList variant="line" className="gap-0">
              <TabsTrigger value="preview" className={cn(TAB_TRIGGER, "flex-1")}>
                <HugeIcon icon={ViewIcon} size={16} />
                Preview
              </TabsTrigger>
              <TabsTrigger value="components" className={cn(TAB_TRIGGER, "flex-1")}>
                <HugeIcon icon={DashboardSquare01Icon} size={16} />
                Components
              </TabsTrigger>
            </TabsList>

            {/* Toolbar */}
            <div className="flex w-full items-center justify-between gap-4">
              <Select
                value={shown.variant.id}
                onValueChange={(id) => {
                  const v = findVersion(lines, id);
                  if (v) showVersion(v);
                }}
              >
                <SelectTrigger
                  aria-label="Version"
                  className="h-9 w-[150px] rounded-[10px] border-border bg-background px-2.5 shadow-xs"
                >
                  <span className="truncate">Version: {versionName(shown)}</span>
                </SelectTrigger>
                <SelectContent>
                  {[...line].reverse().map((v) => (
                    <SelectItem key={v.variant.id} value={v.variant.id}>
                      {versionName(v)}
                      {v.isCurrent ? " (current)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-1" role="group" aria-label="Device">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-pressed={!mobile}
                  aria-label="Desktop"
                  onClick={() => setViewport((v) => ({ ...v, presetId: RESPONSIVE, zoom: "fit" }))}
                  className={cn("size-8 rounded-[10px]", !mobile && "bg-primary-subtle hover:bg-primary-subtle")}
                >
                  <HugeIcon icon={ComputerIcon} size={16} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-pressed={mobile}
                  aria-label="Mobile"
                  onClick={() => setViewport((v) => ({ ...v, presetId: MOBILE_PRESET, zoom: "fit" }))}
                  className={cn("size-8 rounded-[10px]", mobile && "bg-primary-subtle hover:bg-primary-subtle")}
                >
                  <HugeIcon icon={SmartPhone01Icon} size={16} />
                </Button>
              </div>

              <div className="flex rounded-[10px] bg-muted p-[3px]" role="tablist" aria-label="Design">
                {labels.map((l) => {
                  const active = l === label;
                  return (
                    <button
                      key={l}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => switchLabel(l)}
                      className={cn(
                        "flex h-[25px] items-center rounded-[10px] px-2.5 text-sm font-medium cursor-pointer",
                        active
                          ? cn("shadow-sm", l === "A" ? "bg-design-a-subtle text-design-a-text" : "bg-design-b-subtle text-design-b-text")
                          : "text-muted-foreground"
                      )}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>

            <TabsContent value="preview" className="flex min-h-0 flex-col">
              <PreviewCanvas
                html={shown.variant.html ?? ""}
                documentKey={shown.variant.id}
                viewport={viewport}
                onViewportChange={setViewport}
                pickMode={pickMode}
                onPick={handlePick}
                selection={picked?.selection ?? null}
                canGoBack={shownIndex > 0}
                canGoForward={shownIndex >= 0 && shownIndex < line.length - 1}
                onBack={() => shownIndex > 0 && showVersion(line[shownIndex - 1])}
                onForward={() => shownIndex < line.length - 1 && showVersion(line[shownIndex + 1])}
              />
            </TabsContent>
            <TabsContent value="components" className="flex min-h-0 flex-col">
              <ComponentsBento
                designHtml={shown.variant.html ?? ""}
                components={components}
                selectedId={componentId}
                onSelect={(c) => setComponentId(c.id)}
              />
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-end">
            <Button
              type="button"
              onClick={handleReadyToTest}
              disabled={approving || Boolean(activeJob)}
              className="h-8 gap-1 rounded-[10px] px-2.5"
            >
              {approving ? "Approving…" : "Ready to test"}
              <HugeIcon icon={ArrowRight02Icon} size={16} />
            </Button>
          </div>
        </section>
      </div>

    </div>
  );
}

export default function RefineABPage() {
  return (
    <React.Suspense fallback={null}>
      <RefineContent />
    </React.Suspense>
  );
}
