import type { UserStoryItem } from "@/lib/project-client";

/** One user story is one design cycle: these are its steps. */
export type CycleStepKey = "story" | "prompt" | "refine" | "test";
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
  return cycle.activeJob ? `${round}/generate?job=${cycle.activeJob.id}` : `${round}/generate`;
}

export function storySteps(projectId: string, story: UserStoryItem): CycleStep[] {
  const cycle = story.designCycle;
  const designs = designHref(projectId, story);
  const approved = Boolean(cycle && (cycle.approvedCount > 0 || cycle.roundStatus === "APPROVED"));

  return [
    {
      key: "story",
      label: "User story",
      state: "done",
      href: `/projects/${projectId}/stories`,
    },
    {
      key: "prompt",
      label: "Review prompt",
      state: cycle ? "done" : "current",
      // Approving the prompt again would start another round: only open it before.
      href: cycle ? undefined : `/projects/${projectId}/rounds/new?storyId=${story.id}`,
    },
    {
      key: "refine",
      label: "Refine UI",
      state: !cycle ? "todo" : approved ? "done" : "current",
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
