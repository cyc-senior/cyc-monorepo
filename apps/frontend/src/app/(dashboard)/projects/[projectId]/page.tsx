"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  UserGroupIcon,
  Analytics01Icon,
} from "@hugeicons/core-free-icons";
import {
  getProjectById,
  listUserStories,
  listTestSessions,
  listReports,
  listAuditLogs,
  ProjectDetails,
  UserStoryItem,
  TestSessionItem,
  ReportItem,
  AuditLogItem,
} from "@/lib/project-client";
import { localizeAuditLog } from "@/lib/audit-localization";

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} h ago`;
  if (diffDays < 7) return `${diffDays} d ago`;
  return date.toLocaleDateString();
}

export default function ProjectMainLandingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  // Active tab synchronized with URL query parameter ?tab=...
  const tabFromUrl = searchParams.get("tab");
  const validTabs = ["overview", "stories", "sessions", "reports"] as const;
  type TabType = (typeof validTabs)[number];

  const activeTab: TabType = (
    validTabs.includes(tabFromUrl as TabType) ? tabFromUrl : "overview"
  ) as TabType;

  const setActiveTab = (tab: TabType) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (tab === "overview") {
      sp.delete("tab");
    } else {
      sp.set("tab", tab);
    }
    const query = sp.toString();
    router.replace(query ? `/projects/${projectId}?${query}` : `/projects/${projectId}`, {
      scroll: false,
    });
  };

  const [project, setProject] = React.useState<ProjectDetails | null>(null);
  const [stories, setStories] = React.useState<UserStoryItem[]>([]);
  const [sessions, setSessions] = React.useState<TestSessionItem[]>([]);
  const [reports, setReports] = React.useState<ReportItem[]>([]);
  const [auditLogs, setAuditLogs] = React.useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [proj, userStories, testSessions, reportItems, logs] = await Promise.all([
          getProjectById(projectId),
          listUserStories(projectId).catch(() => []),
          listTestSessions(projectId).catch(() => []),
          listReports(projectId).catch(() => []),
          listAuditLogs(projectId).catch(() => []),
        ]);
        setProject(proj);
        setStories(userStories);
        setSessions(testSessions);
        setReports(reportItems);
        setAuditLogs(logs);
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

  const latestReport = reports.length > 0 ? reports[0] : null;

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

            {/* Design intent link styled matching unselected Tab without active indicator */}
            <Link
              href={`/projects/${projectId}/setup/intent`}
              className="inline-flex items-center justify-center whitespace-nowrap px-3 py-1.5 text-sm font-medium transition-all text-muted-foreground hover:text-foreground cursor-pointer rounded-none border-b-2 border-transparent"
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
                  {stories.map((story, idx) => {
                    const storyKey = story.storyKey || `US${idx + 1}`;

                    return (
                      <Card
                        key={story.id}
                        className="rounded-[14px] border border-border hover:border-foreground/30 transition shadow-2xs overflow-hidden flex flex-col justify-between group cursor-pointer bg-card p-0"
                        onClick={() => router.push(`/projects/${projectId}/rounds/new?storyId=${story.id}`)}
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

                  {auditLogs.length > 0 ? (
                    <div className="space-y-1">
                      {auditLogs.slice(0, 4).map((log, idx) => {
                        const { title, subtitle, badge, iconType } = localizeAuditLog(log);
                        const relativeTime = formatRelativeTime(log.createdAt);
                        const isFirst = idx === 0;

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
                            className={`h-[60px] px-2.5 py-2 rounded-[10px] flex items-center justify-between gap-3 transition-colors ${
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
                                  {subtitle || title}
                                </p>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <span className="rounded-[6px] border border-border px-1.5 py-0.5 text-[10px] font-mono leading-none">
                                    {badge}
                                  </span>
                                  <span className="text-xs text-muted-foreground">{relativeTime}</span>
                                </div>
                              </div>
                            </div>
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
                {stories.map((story, idx) => (
                  <Card
                    key={story.id}
                    className="p-5 rounded-[14px] border-border hover:border-foreground/30 transition shadow-2xs flex flex-col justify-between gap-3 cursor-pointer"
                    onClick={() => router.push(`/projects/${projectId}/rounds/new?storyId=${story.id}`)}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-muted-foreground">
                          {story.storyKey || `US${idx + 1}`}
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
    </div>
  );
}
