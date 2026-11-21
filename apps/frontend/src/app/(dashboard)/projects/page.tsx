"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { listWorkspaceProjects } from "@/services/project.service";
import { ProjectWithRole } from "@/types/project";
import { Button } from "@/components/ui/button";
import { CYCProjectCard, ProjectStatusBadge } from "@/components/projects";
import { HugeIcon } from "@/components/ui/huge-icon";
import {
  FolderAddIcon,
  Search01Icon,
  ArrowDown01Icon,
  GridViewIcon,
  ListViewIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import { getInitials } from "@/lib/utils";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";

function ProjectsView() {
  const router = useRouter();
  const {
    currentWorkspace,
    isLoading: workspaceLoading,
  } = useWorkspace();
  const searchParams = useSearchParams();

  const [projectsList, setProjectsList] = useState<ProjectWithRole[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("NEWEST");
  const [viewMode, setViewMode] = useState<"gallery" | "list">("gallery");

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
        setIsLoadingProjects(false);
        return;
      }
      try {
        setIsLoadingProjects(true);
        const list = await listWorkspaceProjects(workspaceId);
        if (isMounted) {
          setProjectsList(list);
        }
      } catch (err) {
        console.error(
          `Failed to fetch projects from GET /workspaces/${workspaceId}/projects:`,
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

  const filteredProjects = useMemo(() => {
    let result = [...projectsList];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.clientOrProduct && p.clientOrProduct.toLowerCase().includes(q))
      );
    }

    if (roleFilter !== "ALL") {
      result = result.filter((p) => p.role === roleFilter);
    }

    if (sortBy === "NEWEST") {
      result.sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime()
      );
    } else if (sortBy === "OLDEST") {
      result.sort(
        (a, b) =>
          new Date(a.updatedAt || a.createdAt).getTime() -
          new Date(b.updatedAt || b.createdAt).getTime()
      );
    } else if (sortBy === "NAME") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [projectsList, searchQuery, roleFilter, sortBy]);

  if (workspaceLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <HugeIcon icon={Loading03Icon} size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-64px)] bg-background">
      <main className="w-full max-w-7xl mx-auto px-6 sm:px-10 py-10 flex flex-col gap-6">
        {/* Page Head (Figma Node 832:18050 / 819:17019) */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-3xl sm:text-[36px] font-medium tracking-tight text-foreground leading-[40px]">
              Projects
            </h1>
            <p className="text-base text-muted-foreground font-normal leading-6">
              {projectsList.length === 0
                ? `No projects in ${currentWorkspace?.name || "workspace"} yet`
                : `${projectsList.length} ${
                    projectsList.length === 1 ? "project" : "projects"
                  } in ${currentWorkspace?.name || "workspace"}`}
            </p>
          </div>

          {/* New project action only in header when projects exist */}
          {projectsList.length > 0 && currentWorkspace?.id && (
            <div className="flex items-center gap-2">
              <Button
                asChild
                className="rounded-[10px] h-8 px-2.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
              >
                <Link href="/projects/new">New project</Link>
              </Button>
            </div>
          )}
        </div>

        {/* Filter bar (Figma Node 819:17026) */}
        {projectsList.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
              {/* Search input (Figma Node 819:17032) */}
              <div className="relative w-full sm:w-[280px]">
                <HugeIcon
                  icon={Search01Icon}
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <input
                  type="text"
                  placeholder="Search projects…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-9 pr-3 w-full rounded-[10px] border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Role Filter (Figma Node 819:17303) */}
              <div className="relative">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="h-8 pl-3 pr-8 rounded-[10px] border border-border bg-card text-sm font-medium text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="ALL">Role</option>
                  <option value="DESIGNER">Designer</option>
                  <option value="PROJECT_MANAGER">Project Manager</option>
                  <option value="PRODUCT_OWNER">Product Owner</option>
                  <option value="CLIENT">Client</option>
                  <option value="DEVELOPER">Developer</option>
                </select>
                <HugeIcon
                  icon={ArrowDown01Icon}
                  size={14}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
              </div>

              {/* Date / Sort Filter (Figma Node 819:17312) */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="h-8 pl-3 pr-8 rounded-[10px] border border-border bg-card text-sm font-medium text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="NEWEST">Date</option>
                  <option value="OLDEST">Oldest</option>
                  <option value="NAME">Name</option>
                </select>
                <HugeIcon
                  icon={ArrowDown01Icon}
                  size={14}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
              </div>
            </div>

            {/* View toggle (Figma Node 819:17328) */}
            <div className="flex items-center rounded-[10px] border border-border p-0.5 bg-muted/40 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setViewMode("gallery")}
                title="Gallery view"
                className={`h-7 w-7 rounded-[8px] flex items-center justify-center transition-all cursor-pointer ${
                  viewMode === "gallery"
                    ? "bg-card text-foreground shadow-xs font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <HugeIcon icon={GridViewIcon} size={16} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                title="List view"
                className={`h-7 w-7 rounded-[8px] flex items-center justify-center transition-all cursor-pointer ${
                  viewMode === "list"
                    ? "bg-card text-foreground shadow-xs font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <HugeIcon icon={ListViewIcon} size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Projects Grid or Loading / Empty State */}
        {isLoadingProjects ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[340px] w-full rounded-[14px] border border-border bg-muted/40 animate-pulse"
              />
            ))}
          </div>
        ) : projectsList.length === 0 ? (
          /* Empty state (Figma Node 814:10509) */
          <Empty className="bg-[#15095d] flex flex-col gap-6 items-center justify-center px-6 sm:px-10 py-20 rounded-[14px] w-full text-center shadow-xs border-0">
            {/* Hugeicons FolderAddIcon (Node 814:10510) */}
            <EmptyMedia className="size-10 flex items-center justify-center text-white mb-0">
              <HugeIcon icon={FolderAddIcon} size={40} className="text-white" />
            </EmptyMedia>

            {/* Title & Subtitle (Node 814:10511) */}
            <EmptyHeader className="flex flex-col gap-2 items-center text-white max-w-xl">
              <EmptyTitle className="font-heading font-medium text-2xl tracking-[-0.24px] text-white">
                No projects yet
              </EmptyTitle>
              <EmptyDescription className="text-base text-white font-normal leading-6">
                Create your first project to start testing A/B designs with real testers.
              </EmptyDescription>
            </EmptyHeader>

            {/* Action Button: Lime green New Project (Node 814:10515) */}
            {currentWorkspace?.id && (
              <EmptyContent className="mt-0">
                <Button
                  asChild
                  className="rounded-[10px] h-8 px-2.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                >
                  <Link href="/projects/new">New project</Link>
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No projects match your filter.
          </div>
        ) : viewMode === "gallery" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {filteredProjects.map((project) => (
              <CYCProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          /* List view table (Figma Node 820:17537) */
          <div className="w-full rounded-[12px] border border-border bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground">
                    <th className="py-3 px-4 font-medium">Project</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium">Your role</th>
                    <th className="py-3 px-4 font-medium">Team</th>
                    <th className="py-3 px-4 font-medium">Updated</th>
                    <th className="py-3 px-4 font-medium text-right sr-only">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredProjects.map((project) => {
                    const memberInitials =
                      project.members && project.members.length > 0
                        ? project.members.map((m) => getInitials(m.name))
                        : [];
                    const platformText =
                      project.platforms && project.platforms.length > 0
                        ? project.platforms
                            .map((p) =>
                              p === "DESKTOP" ? "Desktop" : p === "MOBILE" ? "Mobile" : "Tablet"
                            )
                            .join(" · ")
                        : "Desktop · Mobile";
                    const updatedDate = project.updatedAt || project.createdAt
                      ? new Date(project.updatedAt || project.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—";

                    return (
                      <tr
                        key={project.id}
                        onClick={() => router.push(`/projects/${project.id}`)}
                        className="hover:bg-muted/40 transition-colors cursor-pointer group"
                      >
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground group-hover:underline">
                              {project.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {platformText}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <ProjectStatusBadge project={project} />
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="text-xs font-medium text-muted-foreground">
                            {project.role
                              ? project.role.replace("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
                              : "Member"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            {memberInitials.slice(0, 3).map((initials, idx) => (
                              <div
                                key={idx}
                                className="size-6 rounded-[10px] bg-muted text-muted-foreground text-xs font-medium flex items-center justify-center select-none"
                              >
                                {initials}
                              </div>
                            ))}
                            {memberInitials.length > 3 && (
                              <span className="text-xs text-muted-foreground pl-0.5">
                                +{memberInitials.length - 3}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-muted-foreground text-xs">
                          {updatedDate}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            href={`/projects/${project.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-primary font-medium hover:underline"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
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