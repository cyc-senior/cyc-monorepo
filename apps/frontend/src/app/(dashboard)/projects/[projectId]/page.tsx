"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HugeIcon } from "@/components/ui/huge-icon";
import {
  Add01Icon,
  Briefcase01Icon,
  CodeIcon,
  Task01Icon,
  Alert02Icon,
  Tick02Icon,
  AiMagicIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import {
  getProjectById,
  listUserStories,
  ProjectDetails,
  UserStoryItem,
} from "@/lib/project-client";

export default function ProjectMainLandingPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [project, setProject] = React.useState<ProjectDetails | null>(null);
  const [stories, setStories] = React.useState<UserStoryItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<
    "overview" | "stories" | "sessions" | "reports"
  >("overview");

  React.useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [proj, userStories] = await Promise.all([
          getProjectById(projectId),
          listUserStories(projectId).catch(() => []),
        ]);
        setProject(proj);
        setStories(userStories);
      } catch (err) {
        console.error("Failed to load project:", err);
      } finally {
        setIsLoading(false);
      }
    }
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  if (isLoading) {
    return (
      <div className="w-full max-w-7xl mx-auto px-6 sm:px-10 py-12 text-center text-muted-foreground">
        Loading project overview...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="w-full p-10 text-center">
        <h2 className="text-xl font-semibold">Project not found</h2>
        <Button asChild className="mt-4">
          <Link href="/projects">Back to projects</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full p-10 flex flex-col gap-6">
      {/* Page Header matching Figma Node 815:11865 (14A) & 815:12248 (14) */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="space-y-1.5 max-w-3xl">
          <h1 className="text-3xl sm:text-4xl font-heading font-medium tracking-tight text-foreground">
            {project.name}
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            {project.description || "Help students book a group study room without checking every room."}
          </p>
        </div>

        {/* Actions matching Figma Node 815:11870 / 815:12253 */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            asChild
            className="rounded-[10px] h-8 px-3 font-medium text-sm border-border cursor-pointer hover:bg-muted"
          >
            <Link href={`/projects/${projectId}/setup/intent`}>
              <span>Edit design intent</span>
            </Link>
          </Button>

          {stories.length > 0 && (
            <Button
              asChild
              className="gap-1.5 rounded-[10px] h-8 px-3.5 font-medium text-sm bg-[#9ae600] text-[#35530e] hover:bg-[#8ee000] cursor-pointer shadow-2xs"
            >
              <Link href={`/projects/${projectId}/stories/new`}>
                <HugeIcon icon={Add01Icon} size={16} />
                <span>New user story</span>
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs navigation matching Figma Node 815:11876 / 815:12260 */}
      <div className="border-b border-border flex items-center gap-6 overflow-x-auto text-sm pt-2">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`pb-2.5 flex items-center gap-2 font-medium transition-colors cursor-pointer border-b-2 -mb-px ${
            activeTab === "overview"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("stories")}
          className={`pb-2.5 flex items-center gap-2 font-medium transition-colors cursor-pointer border-b-2 -mb-px ${
            activeTab === "stories"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>User stories</span>
          <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs font-normal">
            {stories.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("sessions")}
          className={`pb-2.5 flex items-center gap-2 font-medium transition-colors cursor-pointer border-b-2 -mb-px ${
            activeTab === "sessions"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Test sessions</span>
          <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs font-normal">
            {stories.length > 0 ? "3" : "0"}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("reports")}
          className={`pb-2.5 flex items-center gap-2 font-medium transition-colors cursor-pointer border-b-2 -mb-px ${
            activeTab === "reports"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Reports</span>
          <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs font-normal">
            {stories.length > 0 ? "1" : "0"}
          </span>
        </button>

        <Link
          href={`/projects/${projectId}/setup/intent`}
          className="pb-2.5 flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer border-b-2 border-transparent -mb-px"
        >
          <span>Design intent</span>
        </Link>
      </div>

      {/* Main Content: Screen 14A (Empty state) vs Screen 14 (Project main page) */}
      {stories.length === 0 ? (
        /* Screen 14A: No user stories yet (Figma Node 815:11884) */
        <div className="w-full rounded-[14px] bg-[#15095d] text-white py-16 sm:py-20 px-6 sm:px-12 flex flex-col items-center justify-center text-center shadow-xs">
          {/* Folder with plus vector icon matching Figma Node 815:11885 */}
          <div className="mb-6 flex items-center justify-center">
            <svg
              width="40"
              height="40"
              viewBox="0 0 40 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-white"
            >
              <path
                d="M3.33 13.33V8.33C3.33 6.49 4.82 5 6.67 5H15.42C16.3 5 17.15 5.35 17.77 5.98L20.55 8.76C21.18 9.38 22.02 9.74 22.91 9.74H33.33C35.18 9.74 36.67 11.23 36.67 13.07V20"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M3.33 15C3.33 13.16 4.82 11.67 6.67 11.67H33.33C35.18 11.67 36.67 13.16 36.67 15V31.67C36.67 33.51 35.18 35 33.33 35H6.67C4.82 35 3.33 33.51 3.33 31.67V15Z"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <path
                d="M26.67 25H33.33M30 21.67V28.33"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <h2 className="text-2xl sm:text-3xl font-heading font-medium tracking-tight text-white">
            No user stories yet
          </h2>

          <p className="text-base text-slate-200 mt-2 max-w-xl mx-auto leading-relaxed">
            Add a user story to start. AI builds an A and a B, testers try both, and you get a report.
          </p>

          <Link
            href={`/projects/${projectId}/stories/new`}
            className="mt-6 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[10px] bg-[#9ae600] text-[#35530e] font-medium text-sm hover:bg-[#8ee000] active:scale-[0.98] transition-all shadow-xs cursor-pointer"
          >
            <HugeIcon icon={Add01Icon} size={16} />
            <span>New user story</span>
          </Link>
        </div>
      ) : (
        /* Screen 14: Project main page with stories (Figma Node 815:12229) */
        <div className="space-y-8">
          {/* Section 1: User Stories Gallery matching Figma Node 815:12267 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-heading font-medium text-foreground">
                User stories
              </h2>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <Link href={`/projects/${projectId}/stories`}>
                  <span>View all</span>
                </Link>
              </Button>
            </div>

            {/* Gallery grid matching Figma Node 924:20995 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stories.map((story, idx) => {
                const storyKey = story.storyKey || `US${idx + 1}`;
                const isFirst = idx === 0;
                const isSecond = idx === 1;

                return (
                  <Card
                    key={story.id}
                    className="rounded-[14px] border-border hover:border-foreground/30 transition shadow-2xs overflow-hidden flex flex-col justify-between group cursor-pointer"
                    onClick={() => router.push(`/projects/${projectId}/rounds/new?storyId=${story.id}`)}
                  >
                    {/* Thumbnail matching Figma Node 924:20997 / 924:21158 / 924:21174 */}
                    <div className="h-[120px] bg-muted/40 border-b border-border/60 p-4 flex items-center justify-center overflow-hidden relative">
                      {isFirst ? (
                        <div className="flex items-center gap-2 w-full h-full justify-center opacity-90">
                          {/* Mini Design A preview */}
                          <div className="w-[140px] h-[90px] rounded-md border border-border bg-card p-2 flex flex-col justify-between shadow-2xs text-[8px] leading-tight select-none">
                            <span className="font-medium text-foreground text-[9px] truncate">Design A</span>
                            <div className="grid grid-cols-4 gap-1 py-1">
                              <span className="bg-muted rounded h-3 flex items-center justify-center text-[7px] text-muted-foreground">10:00</span>
                              <span className="bg-[#e2f3e5] rounded h-3 flex items-center justify-center text-[7px] text-[#2e7d32]">Free</span>
                              <span className="bg-muted rounded h-3 flex items-center justify-center text-[7px] text-muted-foreground">12:00</span>
                              <span className="bg-[#ffedd5] text-[#c2410c] rounded h-3 flex items-center justify-center text-[7px]">Pick</span>
                            </div>
                            <span className="text-[7px] text-muted-foreground">4 seats · Room 3</span>
                          </div>

                          {/* Mini Design B preview */}
                          <div className="w-[140px] h-[90px] rounded-md border border-border bg-card p-2 flex flex-col justify-between shadow-2xs text-[8px] leading-tight select-none">
                            <span className="font-medium text-foreground text-[9px] truncate">Design B</span>
                            <div className="space-y-1">
                              <div className="h-3 bg-muted rounded px-1 flex items-center justify-between text-[7px]">
                                <span>Tomorrow</span>
                                <span className="text-muted-foreground">4 ppl</span>
                              </div>
                              <div className="h-3 border border-[#ff8a3d] text-[#ff8a3d] rounded px-1 flex items-center justify-between text-[7px]">
                                <span>13:00–15:00</span>
                                <span>Selected</span>
                              </div>
                            </div>
                            <span className="text-[7px] text-muted-foreground">Room 2 · 6 seats</span>
                          </div>
                        </div>
                      ) : isSecond ? (
                        <div className="text-center text-muted-foreground text-xs font-normal">
                          No designs yet
                        </div>
                      ) : (
                        <div className="w-[160px] h-[90px] rounded-md border border-border bg-card p-2 flex flex-col justify-between shadow-2xs text-[8px] select-none">
                          <span className="font-medium text-foreground text-[9px]">Sign in preview</span>
                          <div className="space-y-1">
                            <div className="h-2.5 bg-muted rounded w-full" />
                            <div className="h-2.5 bg-muted rounded w-full" />
                            <div className="h-3 bg-[#f2652a] rounded w-full" />
                          </div>
                          <span className="text-[7px] text-muted-foreground">Student ID & Password</span>
                        </div>
                      )}
                    </div>

                    {/* Card Body matching Figma Node 924:21135 */}
                    <div className="p-5 flex flex-col justify-between flex-1 gap-3">
                      <div>
                        {/* Meta row */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="rounded-[10px] border border-border px-2 py-0.5 text-xs font-mono font-medium text-foreground">
                            {storyKey}
                          </span>

                          {isFirst ? (
                            <span className="rounded-[10px] bg-[#ffedd5] text-[#c2410c] px-2 py-0.5 text-xs font-medium">
                              T3 needs you
                            </span>
                          ) : isSecond ? (
                            <span className="rounded-[10px] bg-muted text-muted-foreground px-2 py-0.5 text-xs font-medium">
                              Prompt & context
                            </span>
                          ) : (
                            <span className="rounded-[10px] bg-[#ecfccb] text-[#4d7c0f] px-2 py-0.5 text-xs font-medium">
                              Report published
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <h3 className="text-base font-semibold text-foreground line-clamp-2 leading-snug">
                          {story.want || "Untitled user story"}
                        </h3>
                      </div>

                      {/* Footer row matching Figma Node 924:21144 */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
                        <div className="flex items-center gap-2">
                          {/* Testers Avatars */}
                          <div className="flex items-center -space-x-1.5">
                            <span className="h-5 w-5 rounded-full bg-muted border border-card flex items-center justify-center text-[9px] font-medium text-foreground">
                              T1
                            </span>
                            <span className="h-5 w-5 rounded-full bg-muted border border-card flex items-center justify-center text-[9px] font-medium text-foreground">
                              T2
                            </span>
                            <span className="h-5 w-5 rounded-full bg-muted border border-card flex items-center justify-center text-[9px] font-medium text-foreground">
                              T3
                            </span>
                            <span className="h-5 w-5 rounded-full bg-muted border border-card flex items-center justify-center text-[9px] font-medium text-muted-foreground">
                              +2
                            </span>
                          </div>
                          <span className="text-xs">
                            {isFirst ? "4 testing, 1 done" : isSecond ? "No testers yet" : "5 finished"}
                          </span>
                        </div>

                        <span className="text-xs shrink-0">
                          {isFirst ? "20 min ago" : isSecond ? "Yesterday" : "20 Oct"}
                        </span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Section 2: Bottom Row (Latest Report & Activity) matching Figma Node 815:12294 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Latest Report matching Figma Node 815:12296 */}
            <div className="rounded-[14px] border border-border bg-card p-6 shadow-xs flex flex-col justify-between space-y-4">
              <h2 className="text-xl font-heading font-medium text-foreground">
                Latest report
              </h2>

              {/* Report Hero Card matching Figma Node 928:21116 */}
              <div className="rounded-xl bg-[#15095d] text-white p-4 flex items-center gap-4 shadow-sm">
                <div className="w-14 h-14 rounded-lg bg-white/10 border border-white/20 flex flex-col justify-center items-center shrink-0 p-1 text-[8px] text-slate-200">
                  <span className="font-semibold text-white">Sign-in</span>
                  <div className="w-8 h-1 bg-[#ff8a3d] rounded mt-1" />
                </div>

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#251f73] text-white text-[10px] px-2 py-0.5 font-mono">
                      US0
                    </span>
                    <span className="rounded-full bg-[#9ae600] text-[#35530e] text-[10px] px-2 py-0.5 font-medium">
                      Final UI
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-white truncate">
                    Sign in with a student account
                  </h4>
                  <p className="text-xs text-[#cbd1fa]">
                    Published 20 Oct
                  </p>
                </div>
              </div>

              {/* Stats Row matching Figma Node 928:21146 */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-[10px] border border-border p-3 space-y-0.5">
                  <span className="font-heading font-medium text-xl text-[#15095d] dark:text-indigo-300 block">
                    5
                  </span>
                  <span className="text-xs text-muted-foreground block">
                    Testers
                  </span>
                </div>

                <div className="rounded-[10px] border border-border p-3 space-y-0.5">
                  <span className="font-heading font-medium text-xl text-[#15095d] dark:text-indigo-300 block">
                    5
                  </span>
                  <span className="text-xs text-muted-foreground block">
                    Rounds each
                  </span>
                </div>

                <div className="rounded-[10px] border border-border p-3 space-y-0.5">
                  <span className="font-heading font-medium text-xl text-[#15095d] dark:text-indigo-300 block">
                    38
                  </span>
                  <span className="text-xs text-muted-foreground block">
                    Comments
                  </span>
                </div>
              </div>

              {/* Role Reports Row matching Figma Node 928:21166 */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-lg bg-[#f3f4ff] dark:bg-muted text-[#15095d] dark:text-foreground px-2.5 py-1 text-xs font-medium flex items-center gap-1.5">
                    <HugeIcon icon={Briefcase01Icon} size={14} />
                    <span>Client</span>
                  </span>
                  <span className="rounded-lg bg-[#f3f4ff] dark:bg-muted text-[#15095d] dark:text-foreground px-2.5 py-1 text-xs font-medium flex items-center gap-1.5">
                    <HugeIcon icon={CodeIcon} size={14} />
                    <span>Developer</span>
                  </span>
                  <span className="rounded-lg bg-[#f3f4ff] dark:bg-muted text-[#15095d] dark:text-foreground px-2.5 py-1 text-xs font-medium flex items-center gap-1.5">
                    <HugeIcon icon={Task01Icon} size={14} />
                    <span>PM</span>
                  </span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="rounded-[10px] h-8 px-2.5 text-xs font-medium border-border cursor-pointer hover:bg-muted shrink-0"
                >
                  <Link href={`/projects/${projectId}/reports`}>
                    <span>Open reports</span>
                  </Link>
                </Button>
              </div>
            </div>

            {/* Right Column: Activity matching Figma Node 815:12297 */}
            <div className="rounded-[14px] border border-border bg-card p-6 shadow-xs flex flex-col justify-between space-y-3">
              <h2 className="text-xl font-heading font-medium text-foreground">
                Activity
              </h2>

              <div className="space-y-1">
                {/* Activity Item 1 */}
                <div className="p-2.5 rounded-[10px] bg-[#f3f4ff] dark:bg-muted/40 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-card flex items-center justify-center shrink-0 border border-border/50">
                      <HugeIcon icon={Alert02Icon} size={16} className="text-[#ff8a3d]" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm text-foreground truncate">
                        T3&apos;s feedback goes up and down
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded-[6px] border border-border px-1 py-0.2 text-[10px] font-mono">
                          US1
                        </span>
                        <span>20 min ago</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="h-7 px-2.5 text-xs rounded-[8px] bg-card border-border shrink-0 cursor-pointer"
                  >
                    <Link href={`/projects/${projectId}/rounds/new?storyId=1`}>
                      <span>Step in</span>
                    </Link>
                  </Button>
                </div>

                {/* Activity Item 2 */}
                <div className="p-2.5 rounded-[10px] hover:bg-muted/30 transition flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-[#ecfcca] flex items-center justify-center shrink-0">
                      <HugeIcon icon={Tick02Icon} size={16} className="text-[#497d00]" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm text-foreground truncate">
                        T1 finished 5 of 5 rounds
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded-[6px] border border-border px-1 py-0.2 text-[10px] font-mono">
                          US1
                        </span>
                        <span>1 h ago</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Activity Item 3 */}
                <div className="p-2.5 rounded-[10px] hover:bg-muted/30 transition flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-[#f3f4ff] dark:bg-muted flex items-center justify-center shrink-0">
                      <HugeIcon icon={AiMagicIcon} size={16} className="text-[#35328d] dark:text-indigo-300" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm text-foreground truncate">
                        AI made A v2
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded-[6px] border border-border px-1 py-0.2 text-[10px] font-mono">
                          US1
                        </span>
                        <span>3 h ago</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Activity Item 4 */}
                <div className="p-2.5 rounded-[10px] hover:bg-muted/30 transition flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <HugeIcon icon={ViewIcon} size={16} className="text-muted-foreground" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm text-foreground truncate">
                        Ploy K. acknowledged the report
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded-[6px] border border-border px-1 py-0.2 text-[10px] font-mono">
                          US0
                        </span>
                        <span>2 d ago</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
