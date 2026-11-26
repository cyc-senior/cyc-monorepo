"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { HugeIcon } from "@/components/ui/huge-icon";
import {
  Add01Icon,
  Alert02Icon,
  Tick02Icon,
  AiMagicIcon,
  ViewIcon,
  UserGroupIcon,
  Analytics01Icon,
  Edit02Icon,
} from "@hugeicons/core-free-icons";
import type { AuditLogItem } from "@/lib/project-client";
import { localizeAuditLog } from "@/lib/audit-localization";
import {
  ActivityButton,
  formatRelativeTime,
  getActivityButton,
} from "@/lib/project-activity";
import { EditProjectDialog } from "./EditProjectDialog";
import { useProjectOverview } from "./use-project-overview";
import { storyCode, storyContinueHref } from "@/lib/design-cycle";

export function ProjectMainLandingView({
  initialTab,
}: {
  initialTab?: "overview" | "stories" | "sessions" | "reports";
}) {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const validTabs = ["overview", "stories", "sessions", "reports"] as const;
  type TabType = (typeof validTabs)[number];

  // Active tab prefers explicit initialTab prop, then query param ?tab=, then defaults to "overview"
  const tabFromUrl = searchParams.get("tab");
  const activeTab: TabType =
    initialTab ||
    (validTabs.includes(tabFromUrl as TabType) ? (tabFromUrl as TabType) : "overview");

  const setActiveTab = (tab: TabType) => {
    if (tab === "overview") {
      router.push(`/projects/${projectId}`);
    } else {
      router.push(`/projects/${projectId}/${tab}`);
    }
  };

  const { project, stories, sessions, reports, auditLogs, isLoading, projectUpdated } =
    useProjectOverview(projectId);

  const [selectedActivity, setSelectedActivity] = React.useState<AuditLogItem | null>(null);
  const [activityError, setActivityError] = React.useState<string | null>(null);

  const [isEditProjectOpen, setIsEditProjectOpen] = React.useState(false);
  const [editDialogKey, setEditDialogKey] = React.useState(0);

  /** Follows an activity button, looking its link up first when needed. */
  const openActivity = async (button: ActivityButton) => {
    setActivityError(null);
    try {
      const href = button.href ?? (await button.resolve?.());
      if (href) router.push(href);
    } catch {
      setActivityError("That item is no longer available.");
    }
  };

  const orderedStories = React.useMemo(
    () =>
      [...stories].sort((a, b) =>
        (a.createdAt ?? "").localeCompare(b.createdAt ?? "")
      ),
    [stories]
  );

  const latestAuditLogs = React.useMemo(() => {
    return [...auditLogs]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 4);
  }, [auditLogs]);

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

  const openEditModal = () => {
    setEditDialogKey((key) => key + 1);
    setIsEditProjectOpen(true);
  };

  const latestReport = reports.length > 0 ? reports[0] : null;

  return (
    <div className="w-full p-10 flex flex-col gap-6">
      {/* Page Header matching Figma Node 815:11865 (14A) & 815:12248 (14) */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="space-y-1.5 max-w-3xl">
          <div className="group flex items-center gap-2.5">
            <h1
              onClick={openEditModal}
              className="text-3xl sm:text-4xl font-heading font-medium tracking-tight text-foreground cursor-pointer hover:underline hover:decoration-muted-foreground/40 underline-offset-4 transition-all"
              title="Click to edit project details"
            >
              {project.name}
            </h1>
            <button
              type="button"
              onClick={openEditModal}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-[8px] hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Edit project details"
              title="Edit project details"
            >
              <HugeIcon icon={Edit02Icon} size={20} />
            </button>
          </div>
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
            <Link href={`/projects/${projectId}/intent`}>
              <span>Edit design intent</span>
            </Link>
          </Button>

          <Button
            asChild
            className="rounded-[10px] h-8 px-3.5 bg-[#9ae600] text-[#35530e] hover:bg-[#8ee000] font-medium text-sm transition-colors cursor-pointer"
          >
            <Link href={`/projects/${projectId}/stories/new`}>
              <HugeIcon icon={Add01Icon} size={16} />
              <span>New user story</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Tabs Navigation matching Figma Node 815:11876 / 815:12260 */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as TabType)}
        className="w-full gap-6"
      >
        <div className="border-b border-border flex items-center overflow-x-auto overflow-y-hidden pt-2 scrollbar-none">
          <TabsList variant="line" className="border-b-0 w-auto">
            <TabsTrigger value="overview">
              Overview
            </TabsTrigger>

            <TabsTrigger value="stories">
              <span>User stories</span>
              <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs font-normal">
                {stories.length}
              </span>
            </TabsTrigger>

            <TabsTrigger value="sessions">
              <span>Test sessions</span>
              <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs font-normal">
                {sessions.length}
              </span>
            </TabsTrigger>

            <TabsTrigger value="reports">
              <span>Reports</span>
              <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs font-normal">
                {reports.length}
              </span>
            </TabsTrigger>

            {/* Design intent opens its own page; it uses the line tab's exact
                spacing (pb-2.5, no top or side padding, 2px underline slot)
                so it lines up with the tabs beside it. */}
            <Link
              href={`/projects/${projectId}/intent`}
              className="-mb-px inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none border-b-2 border-transparent px-0 pb-2.5 pt-0 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
            >
              Design intent
            </Link>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-0 outline-hidden">
          {stories.length === 0 ? (
            /* Screen 14A: No user stories yet (Figma Node 815:11884) */
            <div className="w-full rounded-[14px] bg-[#15095d] text-white py-16 sm:py-20 px-6 sm:px-12 flex flex-col items-center justify-center text-center shadow-xs">
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
                    onClick={() => setActiveTab("stories")}
                    className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <span>View all</span>
                  </Button>
                </div>

                {/* Gallery grid matching Figma Node 924:20995 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {orderedStories.map((story) => {
                    const storyKey = story.storyKey || storyCode(stories, story);

                    return (
                      <Card
                        key={story.id}
                        className="rounded-[14px] border border-border hover:border-foreground/30 transition shadow-2xs overflow-hidden flex flex-col justify-between group cursor-pointer bg-card p-0"
                        onClick={() => router.push(storyContinueHref(projectId, story))}
                      >
                        {/* Thumbnail matching Figma Node 924:20997: height 120px, bg #f5f5f5, pt-4 px-4, no bottom padding */}
                        <div className="h-[120px] bg-[#f5f5f5] dark:bg-muted/30 border-b border-border/60 px-4 pt-4 pb-0 flex items-end justify-center gap-2 overflow-hidden select-none">
                          {/* Mini Preview Screen A matching Figma Node 924:20998 */}
                          <div className="flex-1 h-full rounded-t-[6px] bg-card border border-border border-b-0 shadow-2xs p-2 flex flex-col justify-between opacity-90 group-hover:opacity-100 transition-opacity">
                            <div className="flex items-center justify-between">
                              <span className="text-[7px] font-semibold text-foreground/80 leading-none">Find a room</span>
                              <span className="h-1.5 w-4 bg-muted rounded-xs" />
                            </div>
                            <div className="space-y-1 my-auto">
                              <div className="grid grid-cols-4 gap-0.5">
                                <div className="h-2 rounded-[2px] bg-muted/60" />
                                <div className="h-2 rounded-[2px] bg-primary/20" />
                                <div className="h-2 rounded-[2px] bg-muted/60" />
                                <div className="h-2 rounded-[2px] bg-emerald-500/20" />
                              </div>
                              <div className="grid grid-cols-4 gap-0.5">
                                <div className="h-2 rounded-[2px] bg-emerald-500/20" />
                                <div className="h-2 rounded-[2px] bg-muted/60" />
                                <div className="h-2 rounded-[2px] bg-primary/20" />
                                <div className="h-2 rounded-[2px] bg-muted/60" />
                              </div>
                            </div>
                            <div className="h-2.5 w-10 bg-primary/30 rounded-xs self-end" />
                          </div>

                          {/* Mini Preview Screen B matching Figma Node 924:21092 */}
                          <div className="flex-1 h-full rounded-t-[6px] bg-card border border-border border-b-0 shadow-2xs p-2 flex flex-col justify-between opacity-90 group-hover:opacity-100 transition-opacity">
                            <div className="flex items-center justify-between">
                              <span className="text-[7px] font-semibold text-foreground/80 leading-none">Time first</span>
                              <span className="h-1.5 w-3 bg-muted rounded-xs" />
                            </div>
                            <div className="space-y-1 my-auto">
                              <div className="h-2 w-full bg-muted/50 rounded-xs" />
                              <div className="h-2 w-3/4 bg-primary/20 rounded-xs" />
                              <div className="h-2 w-5/6 bg-muted/50 rounded-xs" />
                            </div>
                            <div className="h-2.5 w-10 bg-primary/30 rounded-xs self-end" />
                          </div>
                        </div>

                        {/* Card Content matching Figma Node 924:21135: padding 20px (p-5), space-y-3 */}
                        <div className="p-5 flex flex-col justify-between flex-1 gap-3">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="rounded-[10px] border border-border px-2 py-0.5 text-xs font-medium text-foreground">
                                {storyKey}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted font-medium text-muted-foreground">
                                {story.status || "DRAFT"}
                              </span>
                            </div>
                            <h3 className="text-base font-semibold text-foreground line-clamp-2 leading-snug">
                              {story.title}
                            </h3>
                            {story.problemStatement && (
                              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                {story.problemStatement}
                              </p>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Two-column grid matching Figma Node 815:12290 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Latest report */}
                <div className="rounded-[14px] border border-border bg-card p-6 shadow-xs flex flex-col justify-between space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-heading font-medium text-foreground">
                      Latest report
                    </h2>
                    {reports.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveTab("reports")}
                        className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        View all
                      </Button>
                    )}
                  </div>

                  {latestReport ? (
                    <div className="space-y-4">
                      <div className="rounded-xl bg-[#15095d] text-white p-4 flex items-center gap-4 shadow-sm">
                        <div className="w-14 h-14 rounded-lg bg-white/10 border border-white/20 flex flex-col justify-center items-center shrink-0 p-1 text-[8px] text-slate-200">
                          <span className="font-semibold text-white">Report</span>
                          <div className="w-8 h-1 bg-[#ff8a3d] rounded mt-1" />
                        </div>
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-[#251f73] text-white text-[10px] px-2 py-0.5 font-mono">
                              {latestReport.audience}
                            </span>
                          </div>
                          <h4 className="text-sm font-semibold text-white truncate">
                            {latestReport.summary || "Stakeholder Report"}
                          </h4>
                          <p className="text-xs text-[#cbd1fa]">
                            {new Date(latestReport.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end pt-1 border-t border-border/50">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveTab("reports")}
                          className="rounded-[10px] h-8 px-2.5 text-xs font-medium border-border cursor-pointer hover:bg-muted"
                        >
                          Open reports
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[12px] bg-[#15095d] text-white p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-xs">
                      <div className="mb-3 flex items-center justify-center">
                        <HugeIcon icon={Analytics01Icon} size={32} className="text-white" />
                      </div>
                      <h3 className="text-lg font-heading font-medium tracking-tight text-white">
                        No reports generated yet
                      </h3>
                      <p className="text-xs text-slate-200 mt-1 max-w-sm leading-relaxed">
                        Reports are automatically prepared after participants test your design variants.
                      </p>
                      <Button
                        asChild
                        size="sm"
                        className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-[8px] bg-[#9ae600] text-[#35530e] hover:bg-[#8ee000] font-medium text-xs shadow-xs cursor-pointer"
                      >
                        <Link href={`/projects/${projectId}/reports/generate`}>
                          <HugeIcon icon={Add01Icon} size={14} />
                          <span>Generate report</span>
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>

                {/* Right Column: Activity matching Figma Node 815:12297 */}
                <div className="rounded-[14px] border border-border bg-card p-6 shadow-xs flex flex-col justify-between space-y-4">
                  <h2 className="text-xl font-heading font-medium text-foreground">
                    Activity
                  </h2>
                  {activityError && (
                    <p className="text-xs text-destructive" role="alert">
                      {activityError}
                    </p>
                  )}

                  {latestAuditLogs.length > 0 ? (
                    <div className="space-y-1">
                      {latestAuditLogs.map((log, idx) => {
                        const { title, badge, iconType } = localizeAuditLog(log);
                        const relativeTime = formatRelativeTime(log.createdAt);
                        const isFirst = idx === 0;
                        const actionBtn = getActivityButton(log, projectId);

                        // Type icon styles matching Figma Node I815:12297;182:2081;928:21217 / 21246 / 21269 / 21292
                        let iconBg = "bg-[#f5f5f5] dark:bg-muted";
                        let iconEl = <HugeIcon icon={ViewIcon} size={16} className="text-muted-foreground" />;

                        if (iconType === "alert") {
                          iconBg = "bg-card border border-border/50";
                          iconEl = <HugeIcon icon={Alert02Icon} size={16} className="text-[#ff8a3d]" />;
                        } else if (iconType === "tick") {
                          iconBg = "bg-[#ecfcca] dark:bg-emerald-950/60";
                          iconEl = <HugeIcon icon={Tick02Icon} size={16} className="text-[#497d00] dark:text-emerald-400" />;
                        } else if (iconType === "ai") {
                          iconBg = "bg-[#f3f4ff] dark:bg-muted";
                          iconEl = <HugeIcon icon={AiMagicIcon} size={16} className="text-[#35328d] dark:text-indigo-300" />;
                        }

                        return (
                          <div
                            key={log.id}
                            onClick={() => setSelectedActivity(log)}
                            className={`h-[60px] px-2.5 py-2 rounded-[10px] flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                              isFirst ? "bg-[#f3f4ff] dark:bg-muted/40" : "hover:bg-muted/30"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {/* 32x32 Type Icon container matching Figma */}
                              <div
                                className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}
                              >
                                {iconEl}
                              </div>

                              <div className="min-w-0 space-y-0.5">
                                <p className="text-sm font-normal text-foreground truncate">
                                  {title}
                                </p>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <span className="rounded-[6px] border border-border px-1.5 py-0.5 text-[10px] font-mono leading-none">
                                    {badge}
                                  </span>
                                  <span className="text-xs text-muted-foreground">{relativeTime}</span>
                                </div>
                              </div>
                            </div>

                            {/* Contextual button matching Figma Node 815:12297 (button executes own behavior, does not trigger card modal) */}
                            {actionBtn && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2.5 text-xs font-medium rounded-[10px] shrink-0 border-border/80 bg-background hover:bg-muted/50 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void openActivity(actionBtn);
                                }}
                              >
                                {actionBtn.label}
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-8 text-center border rounded-xl border-dashed bg-muted/20 space-y-1.5">
                      <p className="text-sm font-medium text-foreground">No recent activity</p>
                      <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                        Actions and test interactions in this project will appear here.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="stories" className="mt-0 outline-hidden">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-heading font-medium text-foreground">
                All User Stories ({stories.length})
              </h2>
              <Button
                asChild
                size="sm"
                className="rounded-[10px] bg-[#9ae600] text-[#35530e] hover:bg-[#8ee000] font-medium text-sm"
              >
                <Link href={`/projects/${projectId}/stories/new`}>
                  <HugeIcon icon={Add01Icon} size={16} />
                  <span>New story</span>
                </Link>
              </Button>
            </div>

            {stories.length === 0 ? (
              <div className="rounded-[14px] border border-border bg-card p-12 text-center text-muted-foreground">
                <p className="text-sm">No user stories created yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {orderedStories.map((story) => (
                  <Card
                    key={story.id}
                    className="p-5 rounded-[14px] border-border hover:border-foreground/30 transition shadow-2xs flex flex-col justify-between gap-3 cursor-pointer"
                    onClick={() => router.push(storyContinueHref(projectId, story))}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-muted-foreground">
                          {story.storyKey || storyCode(stories, story)}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted font-medium text-muted-foreground">
                          {story.status || "DRAFT"}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-foreground line-clamp-2">
                        {story.title}
                      </h3>
                      {story.problemStatement && (
                        <p className="text-xs text-muted-foreground line-clamp-3">
                          {story.problemStatement}
                        </p>
                      )}
                    </div>
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      Draft structured prompt
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="sessions" className="mt-0 outline-hidden">
          {sessions.length === 0 ? (
            <div className="w-full rounded-[14px] bg-[#15095d] text-white py-16 sm:py-20 px-6 sm:px-12 flex flex-col items-center justify-center text-center shadow-xs">
              <div className="mb-6 flex items-center justify-center">
                <HugeIcon icon={UserGroupIcon} size={40} className="text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-heading font-medium tracking-tight text-white">
                No test sessions yet
              </h2>
              <p className="text-base text-slate-200 mt-2 max-w-xl mx-auto leading-relaxed">
                Test sessions let real users test your design variants. Once your design round has approved variants, create a test session and invite testers.
              </p>
              <Button
                asChild
                className="mt-6 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[10px] bg-[#9ae600] text-[#35530e] hover:bg-[#8ee000] font-medium text-sm transition-all shadow-xs cursor-pointer"
              >
                <Link href={`/projects/${projectId}/sessions/new`}>
                  <HugeIcon icon={Add01Icon} size={16} />
                  <span>New test session</span>
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-heading font-medium text-foreground">
                  Test Sessions ({sessions.length})
                </h2>
                <Button
                  asChild
                  size="sm"
                  className="rounded-[10px] bg-[#9ae600] text-[#35530e] hover:bg-[#8ee000] font-medium text-sm cursor-pointer"
                >
                  <Link href={`/projects/${projectId}/sessions/new`}>
                    <HugeIcon icon={Add01Icon} size={16} />
                    <span>New test session</span>
                  </Link>
                </Button>
              </div>
              <div className="space-y-2">
                {sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="p-4 rounded-xl border border-border bg-card flex items-center justify-between"
                  >
                    <div>
                      <h4 className="text-sm font-medium">{sess.name || "Test Session"}</h4>
                      <p className="text-xs text-muted-foreground">Status: {sess.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="reports" className="mt-0 outline-hidden">
          {reports.length === 0 ? (
            <div className="w-full rounded-[14px] bg-[#15095d] text-white py-16 sm:py-20 px-6 sm:px-12 flex flex-col items-center justify-center text-center shadow-xs">
              <div className="mb-6 flex items-center justify-center">
                <HugeIcon icon={Analytics01Icon} size={40} className="text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-heading font-medium tracking-tight text-white">
                No stakeholder reports yet
              </h2>
              <p className="text-base text-slate-200 mt-2 max-w-xl mx-auto leading-relaxed">
                Stakeholder reports synthesize findings for Clients, Developers, and Project Managers from test round evaluations.
              </p>
              <Button
                asChild
                className="mt-6 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[10px] bg-[#9ae600] text-[#35530e] hover:bg-[#8ee000] font-medium text-sm transition-all shadow-xs cursor-pointer"
              >
                <Link href={`/projects/${projectId}/reports/generate`}>
                  <HugeIcon icon={Add01Icon} size={16} />
                  <span>Generate report</span>
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-heading font-medium text-foreground">
                  Stakeholder Reports ({reports.length})
                </h2>
                <Button
                  asChild
                  size="sm"
                  className="rounded-[10px] bg-[#9ae600] text-[#35530e] hover:bg-[#8ee000] font-medium text-sm cursor-pointer"
                >
                  <Link href={`/projects/${projectId}/reports/generate`}>
                    <HugeIcon icon={Add01Icon} size={16} />
                    <span>Generate report</span>
                  </Link>
                </Button>
              </div>
              <div className="space-y-2">
                {reports.map((rep) => (
                  <div
                    key={rep.id}
                    className="p-4 rounded-xl border border-border bg-card flex items-center justify-between"
                  >
                    <div>
                      <h4 className="text-sm font-medium">{rep.audience} Report</h4>
                      <p className="text-xs text-muted-foreground">{rep.summary || "Summary"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Activity Details Dialog */}
      <Dialog open={!!selectedActivity} onOpenChange={(open) => !open && setSelectedActivity(null)}>
        <DialogContent className="max-w-md sm:max-w-lg">
          {selectedActivity && (() => {
            const { title, subtitle, badge } = localizeAuditLog(selectedActivity);
            const changesBody = (selectedActivity.changes?.body as Record<string, unknown>) || {};
            const fullDate = new Date(selectedActivity.createdAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            });
            const actionBtn = getActivityButton(selectedActivity, projectId);

            const isHexColor = (val: unknown): val is string =>
              typeof val === "string" && /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/.test(val);

            const formatFieldLabel = (key: string): string =>
              key
                .replace(/([A-Z])/g, " $1")
                .replace(/^./, (str) => str.toUpperCase())
                .trim();

            return (
              <>
                <DialogHeader className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="rounded-[6px] border border-border px-1.5 py-0.5 text-[10px] font-mono leading-none bg-muted/40">
                      {badge}
                    </span>
                    <span className="text-xs text-muted-foreground">{fullDate}</span>
                  </div>
                  <DialogTitle className="text-lg font-heading">{title}</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Activity details and recorded updates
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3.5 py-1 text-sm max-h-[60vh] overflow-y-auto pr-1">
                  {/* Entity-specific formatted views */}
                  {selectedActivity.entityType === "DesignIntent" ? (
                    <div className="space-y-3">
                      {changesBody.statement ? (
                        <div className="p-3.5 rounded-xl bg-muted/30 border border-border/40">
                          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                            Statement
                          </span>
                          <p className="text-sm font-medium text-foreground italic">
                            &ldquo;{String(changesBody.statement)}&rdquo;
                          </p>
                        </div>
                      ) : null}

                      {/* Color Palette */}
                      {Boolean(changesBody.primaryColor || changesBody.secondaryColor || changesBody.accentColor) ? (
                        <div className="p-3.5 rounded-xl border border-border/50 bg-card space-y-2">
                          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                            Color Palette
                          </span>
                          <div className="flex flex-wrap items-center gap-4 pt-0.5">
                            {isHexColor(changesBody.primaryColor) ? (
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-6 w-6 rounded-full border border-border shadow-xs shrink-0"
                                  style={{ backgroundColor: changesBody.primaryColor }}
                                />
                                <div>
                                  <span className="text-[10px] text-muted-foreground block">Primary</span>
                                  <span className="text-xs font-mono font-medium text-foreground">
                                    {changesBody.primaryColor}
                                  </span>
                                </div>
                              </div>
                            ) : null}
                            {isHexColor(changesBody.secondaryColor) ? (
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-6 w-6 rounded-full border border-border shadow-xs shrink-0"
                                  style={{ backgroundColor: changesBody.secondaryColor }}
                                />
                                <div>
                                  <span className="text-[10px] text-muted-foreground block">Secondary</span>
                                  <span className="text-xs font-mono font-medium text-foreground">
                                    {changesBody.secondaryColor}
                                  </span>
                                </div>
                              </div>
                            ) : null}
                            {isHexColor(changesBody.accentColor) ? (
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-6 w-6 rounded-full border border-border shadow-xs shrink-0"
                                  style={{ backgroundColor: changesBody.accentColor }}
                                />
                                <div>
                                  <span className="text-[10px] text-muted-foreground block">Accent</span>
                                  <span className="text-xs font-mono font-medium text-foreground">
                                    {changesBody.accentColor}
                                  </span>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      {/* Design System, Tone, Standards */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {changesBody.designSystem ? (
                          <div className="p-2.5 rounded-xl border border-border/50 bg-card">
                            <span className="text-[11px] text-muted-foreground block mb-0.5">Design System</span>
                            <span className="text-xs font-medium text-foreground capitalize">
                              {String(changesBody.designSystem)}
                            </span>
                          </div>
                        ) : null}
                        {changesBody.toneOfVoice ? (
                          <div className="p-2.5 rounded-xl border border-border/50 bg-card">
                            <span className="text-[11px] text-muted-foreground block mb-0.5">Tone of Voice</span>
                            <span className="text-xs font-medium text-foreground">
                              {String(changesBody.toneOfVoice)}
                            </span>
                          </div>
                        ) : null}
                        {changesBody.designStandards ? (
                          <div className="p-2.5 rounded-xl border border-border/50 bg-card">
                            <span className="text-[11px] text-muted-foreground block mb-0.5">Standard</span>
                            <span className="text-xs font-medium text-foreground">
                              {Array.isArray(changesBody.designStandards)
                                ? changesBody.designStandards.join(", ")
                                : String(changesBody.designStandards)}
                            </span>
                          </div>
                        ) : null}
                      </div>

                      {changesBody.brandGuidelines ? (
                        <div className="p-3 rounded-xl border border-border/50 bg-card space-y-1">
                          <span className="text-[11px] text-muted-foreground block">Brand Guidelines</span>
                          <p className="text-xs text-foreground whitespace-pre-wrap">
                            {String(changesBody.brandGuidelines)}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : selectedActivity.entityType === "UserStory" ? (
                    <div className="space-y-3">
                      {Boolean(changesBody.title || subtitle) ? (
                        <div className="p-3.5 rounded-xl bg-muted/30 border border-border/40">
                          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                            User Story
                          </span>
                          <p className="text-sm font-medium text-foreground">
                            {String(changesBody.title || subtitle)}
                          </p>
                        </div>
                      ) : null}

                      {changesBody.problemStatement ? (
                        <div className="p-3 rounded-xl border border-border/50 bg-card space-y-1">
                          <span className="text-[11px] text-muted-foreground block font-medium">Problem Statement</span>
                          <p className="text-xs text-foreground whitespace-pre-wrap">
                            {String(changesBody.problemStatement)}
                          </p>
                        </div>
                      ) : null}

                      {changesBody.acceptanceCriteria ? (
                        <div className="p-3 rounded-xl border border-border/50 bg-card space-y-1">
                          <span className="text-[11px] text-muted-foreground block font-medium">Acceptance Criteria</span>
                          <p className="text-xs text-foreground whitespace-pre-wrap">
                            {String(changesBody.acceptanceCriteria)}
                          </p>
                        </div>
                      ) : null}

                      {changesBody.description && !changesBody.problemStatement ? (
                        <div className="p-3 rounded-xl border border-border/50 bg-card space-y-1">
                          <span className="text-[11px] text-muted-foreground block font-medium">Description</span>
                          <p className="text-xs text-foreground whitespace-pre-wrap">
                            {String(changesBody.description)}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : selectedActivity.entityType === "UserPersona" ? (
                    <div className="space-y-3">
                      {Boolean(changesBody.name || subtitle) ? (
                        <div className="p-3.5 rounded-xl bg-muted/30 border border-border/40">
                          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                            Persona Name
                          </span>
                          <p className="text-sm font-medium text-foreground">
                            {String(changesBody.name || subtitle)}
                          </p>
                        </div>
                      ) : null}

                      <div className="grid grid-cols-2 gap-2.5">
                        {changesBody.role ? (
                          <div className="p-2.5 rounded-xl border border-border/50 bg-card">
                            <span className="text-[11px] text-muted-foreground block mb-0.5">Role</span>
                            <span className="text-xs font-medium text-foreground">{String(changesBody.role)}</span>
                          </div>
                        ) : null}
                        {changesBody.archetype ? (
                          <div className="p-2.5 rounded-xl border border-border/50 bg-card">
                            <span className="text-[11px] text-muted-foreground block mb-0.5">Archetype</span>
                            <span className="text-xs font-medium text-foreground">{String(changesBody.archetype)}</span>
                          </div>
                        ) : null}
                      </div>

                      {changesBody.goals ? (
                        <div className="p-3 rounded-xl border border-border/50 bg-card space-y-1">
                          <span className="text-[11px] text-muted-foreground block font-medium">Goals</span>
                          <p className="text-xs text-foreground">
                            {Array.isArray(changesBody.goals) ? changesBody.goals.join(", ") : String(changesBody.goals)}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {subtitle && (
                        <div className="p-3.5 rounded-xl bg-muted/30 border border-border/40">
                          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                            Target
                          </span>
                          <p className="text-sm font-medium text-foreground">{subtitle}</p>
                        </div>
                      )}

                      {Object.keys(changesBody).length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {Object.entries(changesBody).map(([key, val]) => {
                            if (["id", "projectId", "createdAt", "updatedAt"].includes(key)) return null;
                            const label = formatFieldLabel(key);
                            const isColor = isHexColor(val);
                            const isArr = Array.isArray(val);

                            return (
                              <div key={key} className="p-2.5 rounded-xl border border-border/50 bg-card">
                                <span className="text-[11px] text-muted-foreground block mb-1">{label}</span>
                                {isColor ? (
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="h-4 w-4 rounded-full border border-border shadow-2xs"
                                      style={{ backgroundColor: val }}
                                    />
                                    <span className="text-xs font-mono font-medium">{val}</span>
                                  </div>
                                ) : isArr ? (
                                  <div className="flex flex-wrap gap-1">
                                    {val.map((item, i) => (
                                      <span
                                        key={i}
                                        className="px-1.5 py-0.5 rounded-[6px] border border-border bg-muted/40 text-[10px] font-mono"
                                      >
                                        {String(item)}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs font-medium text-foreground break-words">
                                    {typeof val === "object" && val !== null ? JSON.stringify(val) : String(val)}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Subtle technical metadata collapsed by default */}
                  <details className="pt-2 border-t border-border/40 text-xs text-muted-foreground">
                    <summary className="text-[11px] font-mono cursor-pointer hover:text-foreground transition-colors select-none py-1">
                      Developer metadata
                    </summary>
                    <div className="mt-2 grid grid-cols-2 gap-2 pt-1 font-mono text-[10px]">
                      <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                        <span className="text-muted-foreground block text-[9px]">ACTION</span>
                        <span className="text-foreground">{selectedActivity.action}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                        <span className="text-muted-foreground block text-[9px]">ENTITY TYPE</span>
                        <span className="text-foreground">{selectedActivity.entityType}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/30 border border-border/40 col-span-2">
                        <span className="text-muted-foreground block text-[9px]">ENTITY ID</span>
                        <span className="text-foreground truncate block">{selectedActivity.entityId || "N/A"}</span>
                      </div>
                    </div>
                  </details>
                </div>

                <DialogFooter className="flex items-center justify-between sm:justify-between pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedActivity(null)}
                  >
                    Close
                  </Button>
                  {actionBtn && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedActivity(null);
                        void openActivity(actionBtn);
                      }}
                    >
                      {actionBtn.label}
                    </Button>
                  )}
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <EditProjectDialog
        // A new key per opening starts the form from the current project.
        key={editDialogKey}
        open={isEditProjectOpen}
        onOpenChange={setIsEditProjectOpen}
        project={project}
        onSaved={projectUpdated}
      />
    </div>
  );
}
