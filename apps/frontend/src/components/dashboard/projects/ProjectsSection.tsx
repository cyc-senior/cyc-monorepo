"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { ProjectWithRole, ProjectRole } from "@/types/project";
import { ProjectRow, defaultFormatRole } from "./ProjectRow";

export interface ProjectsSectionProps {
  projects: ProjectWithRole[];
  isLoading?: boolean;
  formatRole?: (role?: ProjectRole | string) => string;
  viewAllHref?: string;
}

export function ProjectsSection({
  projects,
  isLoading = false,
  formatRole = defaultFormatRole,
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
