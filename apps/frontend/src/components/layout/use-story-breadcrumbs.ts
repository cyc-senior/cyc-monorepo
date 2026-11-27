"use client";

import * as React from "react";
import { useBreadcrumbs } from "@/contexts/breadcrumb-context";
import { listUserStories, UserStoryItem } from "@/lib/project-client";
import { designStepLabel, storyCode } from "@/lib/design-cycle";

/**
 * The design-cycle step a page is. "design" is named like the sidebar step:
 * "Generate design" before the first designs exist, then "Refine UI".
 */
export type StoryStage = "Review prompt" | "design";

/**
 * Breadcrumb of a design-cycle page: `Project › US1 › Generate design | Refine UI`.
 * Every level but the last links up; the story shows its key (as in Figma)
 * with the full title as a tooltip.
 */
export function useStoryBreadcrumbs(
  projectId: string,
  storyId: string | null | undefined,
  stage: StoryStage
) {
  const { project, setBreadcrumbs } = useBreadcrumbs();
  const [stories, setStories] = React.useState<UserStoryItem[]>([]);

  React.useEffect(() => {
    if (!storyId) return;
    let active = true;
    listUserStories(projectId)
      .then((list) => active && setStories(list))
      .catch(() => active && setStories([]));
    return () => {
      active = false;
    };
  }, [projectId, storyId]);

  React.useEffect(() => {
    const story = stories.find((s) => s.id === storyId);
    setBreadcrumbs([
      { label: project?.name ?? "Project", href: `/projects/${projectId}` },
      ...(story
        ? [
            {
              label: storyCode(stories, story),
              title: story.title,
              href: `/projects/${projectId}/stories`,
            },
          ]
        : []),
      {
        label:
          stage === "design"
            ? story
              ? designStepLabel(story)
              : "Generate design"
            : stage,
      },
    ]);
  }, [setBreadcrumbs, project?.name, projectId, stories, storyId, stage]);
}
