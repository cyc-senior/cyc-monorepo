"use client";

import React, { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { mockProjects } from "@/config/mock-projects";
import { ProjectWithRole } from "@/types/project";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CYCProjectCard,
  CreateProjectDialog,
  InviteWorkspaceDialog,
} from "@/components/projects";

type ProjectFilterTab = "all" | "in-testing" | "in-progress" | "completed";

function ProjectsView() {
  const { workspaces, currentWorkspace, setCurrentWorkspace } = useWorkspace();
  const searchParams = useSearchParams();

  // Dialog controls:
  // Node 220:4373 (10 · Project hub) is the default clean view without dialogs.
  // Node 173:1447 (11 · Create project) opens when clicking "New project" or ?new=true
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState<boolean>(
    searchParams.get("new") === "true"
  );
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<ProjectFilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [projectsList] = useState<ProjectWithRole[]>(mockProjects);

  // Compute exact counts for filter tabs matching Figma
  const tabCounts = useMemo(() => {
    const testingCount = projectsList.filter(
      (p) =>
        p.statusBadge?.label.includes("testing") ||
        p.statusBadge?.label.includes("needs you")
    ).length;

    const progressCount = projectsList.filter(
      (p) =>
        p.statusBadge?.label.includes("Prompt") ||
        p.statusBadge?.label.includes("Draft") ||
        p.statusBadge?.label.includes("progress")
    ).length;

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

      // 2. Tab filter
      if (activeTab === "in-testing") {
        return (
          project.statusBadge?.label.includes("testing") ||
          project.statusBadge?.label.includes("needs you")
        );
      }
      if (activeTab === "in-progress") {
        return (
          project.statusBadge?.label.includes("Prompt") ||
          project.statusBadge?.label.includes("Draft") ||
          project.statusBadge?.label.includes("progress")
        );
      }
      if (activeTab === "completed") {
        return (
          project.statusBadge?.label.includes("Completed") ||
          project.statusBadge?.label.includes("ready")
        );
      }

      return true; // "all"
    });
  }, [projectsList, activeTab, searchQuery]);

  const initialLetter = currentWorkspace?.name
    ? currentWorkspace.name.charAt(0).toUpperCase()
    : "S";

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-64px)] bg-background">
      {/* 1. Breadcrumbs Bar (Figma Node 220:4421) */}
      <div className="w-full border-b border-border bg-background px-6 lg:px-20 h-11 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Workspace Mark: Single letter square */}
          <div className="flex size-6 items-center justify-center rounded-[8px] bg-muted text-muted-foreground text-xs font-semibold shrink-0 select-none">
            {initialLetter}
          </div>

          {/* Workspace Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none font-normal"
              >
                <span>{currentWorkspace?.name || "Studio workspace"}</span>
                <ChevronDown className="size-3.5 text-muted-foreground transition-transform" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 rounded-xl">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                Workspaces
              </div>
              {workspaces.map((ws) => (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => setCurrentWorkspace(ws)}
                  className="cursor-pointer gap-2"
                >
                  <div className="flex size-5 items-center justify-center rounded bg-muted text-[11px] font-semibold">
                    {ws.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate text-sm">{ws.name}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="cursor-pointer text-primary-text font-medium">
                <Link href="/create/workspace" className="flex items-center gap-2">
                  <Plus className="size-4" />
                  <span>Create workspace</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <ChevronRight className="size-3.5 text-muted-foreground/60 shrink-0" />

          {/* Projects breadcrumb item */}
          <Link
            href="/projects"
            onClick={() => setIsCreateDialogOpen(false)}
            className={`text-sm transition-colors ${
              isCreateDialogOpen
                ? "text-muted-foreground hover:text-foreground"
                : "text-foreground font-medium"
            }`}
          >
            Projects
          </Link>

          {/* "New project" item added only when create dialog is active */}
          {isCreateDialogOpen && (
            <>
              <ChevronRight className="size-3.5 text-muted-foreground/60 shrink-0" />
              <span className="text-sm font-medium text-foreground">
                New project
              </span>
            </>
          )}
        </div>
      </div>

      {/* 2. Main Page Content (Figma Node 220:4442) */}
      <main className="w-full max-w-7xl mx-auto px-6 lg:px-20 py-8 lg:py-10 flex flex-col gap-8">
        {/* Page Head (Figma Node 220:4443) */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-3xl sm:text-[36px] font-medium tracking-tight text-foreground leading-tight">
              Projects
            </h1>
            <p className="text-base text-muted-foreground font-normal">
              {projectsList.length} projects in {currentWorkspace?.name || "Studio workspace"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setIsInviteDialogOpen(true)}
              className="rounded-[10px] h-8 px-2.5 text-sm font-medium border-border hover:bg-accent text-foreground cursor-pointer"
            >
              Invite to workspace
            </Button>

            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              className="rounded-[10px] h-8 px-2.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
            >
              New project
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

        {/* 3-Column Projects Grid (Figma Rows 1 & 2) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
          {filteredProjects.map((project) => (
            <CYCProjectCard key={project.id} project={project} />
          ))}
        </div>
      </main>

      {/* Screen 11 Modal Dialog: New project */}
      <CreateProjectDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSubmit={(data) => {
          console.info("Project created:", data);
          setIsCreateDialogOpen(false);
        }}
      />

      {/* Screen 10A Modal Dialog: Invite to workspace */}
      <InviteWorkspaceDialog
        isOpen={isInviteDialogOpen}
        onClose={() => setIsInviteDialogOpen(false)}
        workspaceName={currentWorkspace?.name || "Studio workspace"}
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
