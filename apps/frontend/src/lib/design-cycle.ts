import type { UserStoryItem } from "@/lib/project-client";

/** One user story is one design cycle: these are its steps. */
export type CycleStepKey = "prompt" | "refine" | "test";
export type CycleStepState = "done" | "current" | "todo";

export interface CycleStep {
  key: CycleStepKey;
  label: string;
  state: CycleStepState;
  /** Where the step is worked on; none while it can't be opened yet. */
  href?: string;
}

/**
 * Where a story's designs are: the Generating page only while its *first*
 * A/B generation runs (or failed before producing designs); afterwards always
 * the Refine page, where refinements show their own progress.
 */
function designHref(projectId: string, story: UserStoryItem): string | undefined {
  const cycle = story.designCycle;
  if (!cycle) return undefined;
  const round = `/projects/${projectId}/rounds/${cycle.roundId}`;
  if (cycle.variantCount > 0) return `${round}/refine`;
  // Cancelled generation shouldn't trap user on dead generate page; route back to prompt
  if (cycle.activeJob?.status === "CANCELLED" || cycle.roundStatus === "CANCELLED") {
    return undefined;
  }
  return cycle.activeJob ? `${round}/generate?job=${cycle.activeJob.id}` : `${round}/generate`;
}

/**
 * The design step's name: "Generate design" until the story's first A/B
 * designs exist, then "Refine UI" (sidebar and breadcrumb).
 */
export function designStepLabel(story: Pick<UserStoryItem, "designCycle">): "Generate design" | "Refine UI" {
  return (story.designCycle?.variantCount ?? 0) > 0 ? "Refine UI" : "Generate design";
}

export function storySteps(projectId: string, story: UserStoryItem): CycleStep[] {
  const cycle = story.designCycle;
  const designs = designHref(projectId, story);
  const approved = Boolean(cycle && (cycle.approvedCount > 0 || cycle.roundStatus === "APPROVED"));
  const isCancelled = Boolean(
    cycle && (cycle.activeJob?.status === "CANCELLED" || cycle.roundStatus === "CANCELLED")
  );

  return [
    {
      key: "prompt",
      label: "Review prompt",
      state: !cycle || isCancelled ? "current" : "done",
      // Approving the prompt again would start another round: open it before designs exist or if cancelled.
      href:
        !cycle || isCancelled || cycle.variantCount === 0
          ? `/projects/${projectId}/rounds/new?storyId=${story.id}`
          : undefined,
    },
    {
      key: "refine",
      label: designStepLabel(story),
      state: !cycle || isCancelled ? "todo" : approved ? "done" : "current",
      href: designs,
    },
    {
      key: "test",
      label: "Test setup",
      state: approved ? "current" : "todo",
      href: approved ? `/projects/${projectId}/sessions` : undefined,
    },
  ];
}

/** Where to continue a story: its designs once they exist, else the prompt. */
export function storyContinueHref(projectId: string, story: UserStoryItem): string {
  return designHref(projectId, story) ?? `/projects/${projectId}/rounds/new?storyId=${story.id}`;
}

/** "US1", "US2", … in creation order. */
export function storyCode(stories: UserStoryItem[], story: UserStoryItem): string {
  const ordered = [...stories].sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
  return `US${ordered.findIndex((s) => s.id === story.id) + 1}`;
}

/** The story's "I want to…" part, which reads best in a narrow sidebar. */
export function storyShortTitle(story: UserStoryItem): string {
  const want = story.title.match(/I want to (.+?)(?:,? so that|$)/i)?.[1];
  const text = want ?? story.title;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
