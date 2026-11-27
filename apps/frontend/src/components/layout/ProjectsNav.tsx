"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { HugeIcon } from "@/components/ui/huge-icon";
import { ArrowDown01Icon, Folder01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/contexts/workspace-context";
import { listWorkspaceProjects } from "@/services/project.service";
import { listUserStories, UserStoryItem } from "@/lib/project-client";
import {
  CycleStep,
  storyCode,
  storyContinueHref,
  storyShortTitle,
  storySteps,
} from "@/lib/design-cycle";

const RECENT_PROJECTS = 3;
const MAX_STORIES = 5;
/** How often steps refresh while a generation runs. */
const ACTIVE_REFRESH_MS = 15_000;

interface NavProject {
  id: string;
  name: string;
  updatedAt?: string;
}

const itemClass = (active: boolean) =>
  cn(
    "flex h-7 w-full items-center gap-2 rounded-[10px] px-2 text-sm transition-colors",
    active
      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
  );

function StepIcon({ state }: { state: CycleStep["state"] }) {
  if (state === "done") {
    return <HugeIcon icon={Tick02Icon} size={16} className="text-primary-text" />;
  }
  return (
    <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
      <span
        className={cn(
          "size-2 rounded-full",
          state === "current" ? "bg-primary" : "bg-muted-foreground/30"
        )}
      />
    </span>
  );
}

/** One story's design cycle: "US1 title", then its steps. */
function StoryCycle({
  projectId,
  story,
  code,
  expanded,
  isStepActive,
}: {
  projectId: string;
  story: UserStoryItem;
  code: string;
  expanded: boolean;
  isStepActive: (step: CycleStep) => boolean;
}) {
  const steps = storySteps(projectId, story);
  return (
    <div className="flex w-full flex-col gap-0.5">
      <Link
        href={storyContinueHref(projectId, story)}
        className="flex h-6 w-full items-center gap-1.5 rounded-[8px] px-2 text-xs text-muted-foreground hover:text-sidebar-foreground"
        title={story.title}
      >
        <span className="shrink-0 font-semibold">{code}</span>
        <span className="min-w-0 flex-1 truncate">{storyShortTitle(story)}</span>
      </Link>
      {expanded &&
        steps.map((step) => {
          const active = isStepActive(step);
          const body = (
            <>
              <StepIcon state={step.state} />
              <span
                className={cn(
                  "whitespace-nowrap",
                  step.state === "todo" && !active && "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </>
          );
          return step.href ? (
            <Link
              key={step.key}
              href={step.href}
              aria-current={active ? "step" : undefined}
              className={itemClass(active)}
            >
              {body}
            </Link>
          ) : (
            <div key={step.key} className={cn(itemClass(active), "cursor-default hover:bg-transparent")}>
              {body}
            </div>
          );
        })}
    </div>
  );
}

/**
 * Sidebar "Recent projects": the workspace's latest projects, with the open
 * project expanded into its pages and each user story's design cycle
 * (User story → Review prompt → Refine UI → Test setup).
 */
export function ProjectsNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { currentWorkspace } = useWorkspace();
  const [projects, setProjects] = React.useState<NavProject[]>([]);
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [stories, setStories] = React.useState<Record<string, UserStoryItem[]>>({});

  const currentProjectId = pathname.match(/^\/projects\/([0-9a-f-]{36})/)?.[1] ?? null;
  const tab = searchParams.get("tab");

  // Projects of the workspace, refreshed when another project is opened.
  React.useEffect(() => {
    if (!currentWorkspace) return;
    let active = true;
    listWorkspaceProjects(currentWorkspace.id)
      .then((list) => active && setProjects(list))
      .catch(() => active && setProjects([]));
    return () => {
      active = false;
    };
  }, [currentWorkspace, currentProjectId]);

  const isOpen = (id: string) => expanded[id] ?? id === currentProjectId;
  const openIds = projects.map((p) => p.id).filter(isOpen);
  const openKey = openIds.join(",");

  // Stories (with their design cycle) of every expanded project; refreshed on
  // navigation, and periodically while a generation runs.
  const generating = openIds.some((id) => stories[id]?.some((s) => s.designCycle?.activeJob));
  React.useEffect(() => {
    if (!openKey) return;
    let active = true;
    const load = () =>
      Promise.all(
        openKey.split(",").map(async (id) => [id, await listUserStories(id).catch(() => [])] as const)
      ).then((entries) => active && setStories((prev) => ({ ...prev, ...Object.fromEntries(entries) })));
    void load();
    const timer = generating ? setInterval(load, ACTIVE_REFRESH_MS) : undefined;
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [openKey, pathname, generating]);

  const recent = React.useMemo(() => {
    const sorted = [...projects].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
    const top = sorted.slice(0, RECENT_PROJECTS);
    const current = sorted.find((p) => p.id === currentProjectId);
    return current && !top.includes(current) ? [current, ...top.slice(0, RECENT_PROJECTS - 1)] : top;
  }, [projects, currentProjectId]);

  if (recent.length === 0) {
    return (
      <Link href="/projects" className={itemClass(false)}>
        <HugeIcon icon={Folder01Icon} size={16} className="text-muted-foreground" />
        <span className="truncate text-muted-foreground">All projects</span>
      </Link>
    );
  }

  return (
    <nav className="flex flex-col gap-1" aria-label="Recent projects">
      {recent.map((project) => {
        const open = isOpen(project.id);
        const base = `/projects/${project.id}`;
        const here = project.id === currentProjectId;
        const list = (stories[project.id] ?? [])
          .slice()
          .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
          .slice(0, MAX_STORIES)
          .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
        // The story being worked on: from the route, else the newest one.
        // /projects/{p}/stories/{storyId}(/prompt): the story in the path.
        const routeStoryId = pathname.match(/\/stories\/([0-9a-f-]{36})(?:\/|$)/)?.[1] ?? null;
        const currentStory =
          list.find((s) => s.id === routeStoryId) ??
          list.find((s) => s.designCycle && pathname.includes(`/rounds/${s.designCycle.roundId}/`)) ??
          list.at(-1);
        const isStepActive = (step: CycleStep) => {
          if (!here || !step.href) return false;
          const [path, query] = step.href.split("?");
          if (step.key === "refine") return pathname.startsWith(path.replace(/\/(refine|generate)$/, ""));
          if (step.key === "prompt") return pathname === path;
          return pathname === path && Boolean(query) && tab === new URLSearchParams(query).get("tab");
        };

        return (
          <div key={project.id} className="flex flex-col gap-1">
            <div className={cn(itemClass(here && pathname === base && !tab), "h-8 pr-1")}>
              <HugeIcon icon={Folder01Icon} size={16} className="text-sidebar-foreground" />
              <Link href={base} className="min-w-0 flex-1 truncate" title={project.name}>
                {project.name}
              </Link>
              <button
                type="button"
                onClick={() => setExpanded((prev) => ({ ...prev, [project.id]: !open }))}
                aria-expanded={open}
                aria-label={open ? `Collapse ${project.name}` : `Expand ${project.name}`}
                className="flex size-6 items-center justify-center rounded-[8px] text-muted-foreground hover:text-sidebar-foreground cursor-pointer"
              >
                <HugeIcon
                  icon={ArrowDown01Icon}
                  size={16}
                  className={cn("transition-transform", !open && "-rotate-90")}
                />
              </button>
            </div>

            {open && (
              <div className="flex w-full flex-col pl-3.5">
                <div className="flex w-full flex-col gap-0.5 border-l border-border py-0.5 pl-2.5">
                  <Link href={base} className={itemClass(here && pathname === base && !tab)}>
                    <span className="truncate">Overview</span>
                  </Link>
                  <Link
                    href={`${base}/stories`}
                    className={itemClass(here && (pathname === `${base}/stories` || pathname === `${base}/stories/new`))}
                  >
                    <span className="truncate">User stories</span>
                  </Link>
                  {list.length > 0 && (
                    <div className="ml-2.5 flex w-[calc(100%-0.625rem)] flex-col gap-0.5 border-l border-border pb-1 pl-2.5 pt-0.5">
                      {list.map((story) => (
                        <StoryCycle
                          key={story.id}
                          projectId={project.id}
                          story={story}
                          code={storyCode(stories[project.id] ?? [], story)}
                          expanded={story.id === currentStory?.id}
                          isStepActive={isStepActive}
                        />
                      ))}
                    </div>
                  )}
                  <Link href={`${base}/intent`} className={itemClass(here && pathname === `${base}/intent`)}>
                    <span className="truncate">Design intent</span>
                  </Link>
                  <Link href={`${base}/team`} className={itemClass(here && pathname === `${base}/team`)}>
                    <span className="truncate">Team &amp; roles</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <Link href="/projects" className="flex h-7 items-center gap-2 rounded-[10px] px-2 text-xs text-muted-foreground hover:text-sidebar-foreground">
        All projects
      </Link>
    </nav>
  );
}
