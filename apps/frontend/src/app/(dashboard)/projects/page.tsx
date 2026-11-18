"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { listWorkspaceProjects } from "@/services/project.service";
import { ProjectWithRole } from "@/types/project";
import { FolderPlus, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CYCProjectCard,
  InviteWorkspaceDialog,
} from "@/components/projects";
import { DashboardBreadcrumb } from "@/components/dashboard/DashboardBreadcrumb";

type ProjectFilterTab = "all" | "in-testing" | "in-progress" | "completed";

function ProjectsView() {
  const router = useRouter();
  const {
    workspaces,
    currentWorkspace,
    setCurrentWorkspace,
    isLoading: workspaceLoading,
  } = useWorkspace();
  const searchParams = useSearchParams();

  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<ProjectFilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [projectsList, setProjectsList] = useState<ProjectWithRole[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState<boolean>(false);

  // Sync ?new=true query param -> redirect to /projects/new
  useEffect(() => {
    if (searchParams.get("new") === "true") {
      router.replace("/projects/new");
    }
  }, [searchParams, router]);

  // Fetch projects for the active workspace from Backend API
  const workspaceId = currentWorkspace?.id;

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!workspaceId) {
        return;
      }
      try {
        const list = await listWorkspaceProjects(workspaceId);
        if (isMounted) {
          setProjectsList(list);
        }
      } catch (err) {
        console.error(
          `Failed to fetch projects from GET /organizations/${workspaceId}/projects:`,
          err
        );
        if (isMounted) {
          setProjectsList([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingProjects(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [workspaceId]);



  // Compute exact counts for filter tabs
  const tabCounts = useMemo(() => {
    const testingCount = projectsList.filter(
      (p) =>
        p.statusBadge?.label.includes("testing") ||
        p.statusBadge?.label.includes("needs you")
    ).length;

    const progressCount = projectsList.filter((p) => {
      const label =
        p.statusBadge?.label ||
        (p.hasDesignIntent ? "In progress" : "Draft · Design intent");
      return (
        label.includes("Prompt") ||
        label.includes("Draft") ||
        label.includes("progress")
      );
    }).length;

    const completedCount = projectsList.filter(
      (p) =>
        p.statusBadge?.label.includes("Completed") ||
        p.statusBadge?.label.includes("ready")
    ).length;

    return {
      all: projectsList.length,
      testing: testingCount,
      progress: progressCount,
      completed: completedCount,
    };
  }, [projectsList]);

  // Filter projects by tab & search query
  const filteredProjects = useMemo(() => {
    return projectsList.filter((project) => {
      // 1. Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = project.name.toLowerCase().includes(query);
        const matchesDesc = project.description
          ? project.description.toLowerCase().includes(query)
          : false;
        if (!matchesName && !matchesDesc) return false;
      }

      const label =
        project.statusBadge?.label ||
        (project.hasDesignIntent ? "In progress" : "Draft · Design intent");

      // 2. Tab filter
      if (activeTab === "in-testing") {
        return label.includes("testing") || label.includes("needs you");
      }
      if (activeTab === "in-progress") {
        return (
          label.includes("Prompt") ||
          label.includes("Draft") ||
          label.includes("progress")
        );
      }
      if (activeTab === "completed") {
        return label.includes("Completed") || label.includes("ready");
      }

      return true; // "all"
    });
  }, [projectsList, activeTab, searchQuery]);

  if (workspaceLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-64px)] bg-background">
      {/* 1. Breadcrumbs Bar (Figma Node 220:4421) */}
      <DashboardBreadcrumb
        workspaces={workspaces}
        currentWorkspace={currentWorkspace}
        onSelectWorkspace={setCurrentWorkspace}
        currentPage="Projects"
      />

      {/* 2. Main Page Content (Figma Node 220:4442) */}
      <main className="w-full max-w-7xl mx-auto px-6 lg:px-20 py-8 lg:py-10 flex flex-col gap-8">
        {/* Page Head (Figma Node 220:4443) */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-3xl sm:text-[36px] font-medium tracking-tight text-foreground leading-tight">
              Projects
            </h1>
            <p className="text-base text-muted-foreground font-normal">
              {projectsList.length}{" "}
              {projectsList.length === 1 ? "project" : "projects"} in{" "}
              {currentWorkspace?.name || "workspace"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={!currentWorkspace?.id}
              onClick={() => setIsInviteDialogOpen(true)}
              className="rounded-[10px] h-8 px-2.5 text-sm font-medium border-border hover:bg-accent text-foreground cursor-pointer"
            >
              Invite to workspace
            </Button>

            <Button
              asChild
              disabled={!currentWorkspace?.id}
              className="rounded-[10px] h-8 px-2.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
            >
              <Link href="/projects/new">New project</Link>
            </Button>
          </div>
        </div>

        {/* Filter Bar (Figma Node 220:4460) */}
        <div className="border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
          {/* Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`h-[25px] px-2.5 py-1 rounded-[10px] text-sm transition-colors cursor-pointer flex items-center justify-center relative ${
                activeTab === "all"
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>All {tabCounts.all}</span>
              {activeTab === "all" && (
                <div className="absolute -bottom-2 left-0 right-0 h-[2px] bg-foreground rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("in-testing")}
              className={`h-[25px] px-2.5 py-1 rounded-[10px] text-sm transition-colors cursor-pointer flex items-center justify-center relative ${
                activeTab === "in-testing"
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>In testing {tabCounts.testing}</span>
              {activeTab === "in-testing" && (
                <div className="absolute -bottom-2 left-0 right-0 h-[2px] bg-foreground rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("in-progress")}
              className={`h-[25px] px-2.5 py-1 rounded-[10px] text-sm transition-colors cursor-pointer flex items-center justify-center relative ${
                activeTab === "in-progress"
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>In progress {tabCounts.progress}</span>
              {activeTab === "in-progress" && (
                <div className="absolute -bottom-2 left-0 right-0 h-[2px] bg-foreground rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("completed")}
              className={`h-[25px] px-2.5 py-1 rounded-[10px] text-sm transition-colors cursor-pointer flex items-center justify-center relative ${
                activeTab === "completed"
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Completed {tabCounts.completed}</span>
              {activeTab === "completed" && (
                <div className="absolute -bottom-2 left-0 right-0 h-[2px] bg-foreground rounded-full" />
              )}
            </button>
          </div>

          {/* Search Input (320px in Figma) */}
          <div className="relative w-full md:w-[320px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects…"
              className="h-8 pl-8 pr-2.5 w-full rounded-[10px] border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all"
            />
          </div>
        </div>

        {/* 3-Column Projects Grid */}
        {isLoadingProjects ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[340px] w-full rounded-[14px] border border-border bg-muted/40 animate-pulse"
              />
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="bg-card border border-border rounded-[14px] py-16 px-6 flex flex-col items-center justify-center text-center gap-3">
            <FolderPlus className="size-10 text-muted-foreground stroke-[1.5]" />
            <p className="font-heading text-lg font-medium text-foreground">
              {projectsList.length === 0
                ? "No projects in this workspace yet"
                : "No projects match your filter"}
            </p>
            <p className="text-sm text-muted-foreground max-w-md">
              {projectsList.length === 0
                ? "Create your first project to start testing A/B designs with real testers."
                : "Try clearing the search query or switching to the All tab."}
            </p>
            {projectsList.length === 0 && currentWorkspace?.id && (
              <Button
                asChild
                className="mt-2 rounded-[10px] h-8 px-3 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
              >
                <Link href="/projects/new">New project</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {filteredProjects.map((project) => (
              <CYCProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </main>

      {/* Screen 10A Modal Dialog: Invite to workspace */}
      <InviteWorkspaceDialog
        isOpen={isInviteDialogOpen}
        onClose={() => setIsInviteDialogOpen(false)}
        workspaceId={currentWorkspace?.id}
        workspaceName={currentWorkspace?.name || "Workspace"}
      />
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <ProjectsView />
    </Suspense>
  );
}
