"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ProjectWithRole, ProjectRole } from "@/types/project";

export interface ProjectRowProps {
  project: ProjectWithRole;
  formatRole?: (role?: ProjectRole | string) => string;
}

export function defaultFormatRole(role?: ProjectRole | string): string {
  if (!role) return "Member";
  switch (role.toUpperCase()) {
    case "DESIGNER":
      return "Designer";
    case "CLIENT":
      return "Client";
    case "DEVELOPER":
      return "Developer";
    case "PROJECT_MANAGER":
      return "Project Manager";
    case "PRODUCT_OWNER":
      return "Product Owner";
    default:
      return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  }
}

export function ProjectRow({ project, formatRole = defaultFormatRole }: ProjectRowProps) {
  const roleText = formatRole(project.role);

  // Status Badge resolution
  const statusBadge = project.statusBadge || {
    label: project.activeRound || "Active",
    type: project.status === "ACTIVE" ? ("ready" as const) : ("in-progress" as const),
  };

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
        {statusBadge.type === "warning" ? (
          <div className="h-[22px] px-2 flex items-center justify-center rounded-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 text-xs font-medium">
            {statusBadge.label}
          </div>
        ) : statusBadge.type === "ready" ? (
          <div className="h-[22px] px-2 flex items-center justify-center rounded-[10px] bg-primary-subtle text-primary-text text-xs font-medium">
            {statusBadge.label}
          </div>
        ) : (
          <div className="h-[22px] px-2 flex items-center justify-center rounded-[10px] bg-secondary text-secondary-foreground text-xs font-medium">
            {statusBadge.label}
          </div>
        )}
      </div>

      {/* 4. Arrow icon */}
      <div className="size-5 flex items-center justify-center text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0">
        <ChevronRight className="size-4" />
      </div>
    </Link>
  );
}
