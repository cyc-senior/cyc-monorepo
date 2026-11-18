"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, Loader2 } from "lucide-react";
import { ProjectWithRole, ProjectRole } from "@/types/project";
import { formatProjectRole } from "@/lib/utils";
import { ProjectStatusBadge } from "@/components/projects/CYCProjectCard";

export { formatProjectRole as defaultFormatRole };

export interface ProjectRowProps {
  project: ProjectWithRole;
  formatRole?: (role?: ProjectRole | string) => string;
}

export function ProjectRow({
  project,
  formatRole = formatProjectRole,
}: ProjectRowProps) {
  const roleText = formatRole(project.role);

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex items-center gap-4 p-4 rounded-2xl bg-card border border-border shadow-xs hover:border-foreground/30 hover:shadow-sm transition-all cursor-pointer"
    >
      {/* 1. Thumbnail: Preview of A/B design */}
      <div className="h-[52px] w-[72px] rounded-[10px] bg-muted relative overflow-hidden shrink-0 border border-border/40 flex items-center justify-center p-1.5">
        <div className="w-full h-full rounded-[6px] bg-background/80 border border-border/30 flex items-center justify-between px-1.5 gap-1 shadow-2xs">
          {/* Design A mini preview */}
          <div className="flex-1 h-7 rounded-[4px] bg-muted/60 border border-border/50 flex flex-col justify-between p-1">
            <div className="size-1 rounded-full bg-indigo-500/70" />
            <div className="w-3/4 h-1 rounded-full bg-muted-foreground/30" />
          </div>
          {/* Design B mini preview */}
          <div className="flex-1 h-7 rounded-[4px] bg-muted/60 border border-border/50 flex flex-col justify-between p-1">
            <div className="size-1 rounded-full bg-primary" />
            <div className="w-3/4 h-1 rounded-full bg-muted-foreground/30" />
          </div>
        </div>
      </div>

      {/* 2. Text Content */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <p className="text-base font-semibold text-foreground group-hover:text-primary transition-colors truncate">
          {project.name}
        </p>
        <p className="text-sm text-muted-foreground truncate">
          {project.clientOrProduct || project.description || "Testing project"}
        </p>
      </div>

      {/* 3. Badges */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Role Badge (Outline) */}
        <div className="h-[22px] px-2 flex items-center justify-center rounded-[10px] border border-border bg-background text-xs font-medium text-foreground">
          {roleText}
        </div>

        {/* Status Badge */}
        <ProjectStatusBadge
          project={project}
          fallbackLabel={project.activeRound || "Active"}
        />
      </div>

      {/* 4. Arrow icon */}
      <div className="size-5 flex items-center justify-center text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0">
        <ChevronRight className="size-4" />
      </div>
    </Link>
  );
}

export interface ProjectsSectionProps {
  projects: ProjectWithRole[];
  isLoading?: boolean;
  formatRole?: (role?: ProjectRole | string) => string;
  viewAllHref?: string;
}

export function ProjectsSection({
  projects,
  isLoading = false,
  formatRole = formatProjectRole,
  viewAllHref = "/projects",
}: ProjectsSectionProps) {
  return (
    <div className="flex-1 flex flex-col gap-4 w-full min-w-0">
      {/* Section Head */}
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-medium text-foreground">
          My projects
        </h2>

        <Link
          href={viewAllHref}
          className="group flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
        >
          <span>View all in Projects</span>
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      {/* Project Rows List */}
      {isLoading ? (
        <div className="flex h-40 items-center justify-center rounded-2xl border border-border bg-card">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : projects.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-border bg-card text-muted-foreground text-sm">
          No projects found in this workspace.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {projects.map((project) => (
            <ProjectRow key={project.id} project={project} formatRole={formatRole} />
          ))}
        </div>
      )}
    </div>
  );
}
