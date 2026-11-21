"use client";

import React from "react";
import Link from "next/link";
import { ProjectWithRole } from "@/types/project";
import { getInitials } from "@/lib/utils";
import { HugeIcon } from "@/components/ui/huge-icon";
import { ComputerIcon, SmartPhone01Icon } from "@hugeicons/core-free-icons";

export interface ProjectStatusBadgeProps {
  project: ProjectWithRole;
  fallbackLabel?: string;
}

/**
 * Shared Status Badge for projects (used in Dashboard ProjectRow and Projects Hub CYCProjectCard).
 */
export function ProjectStatusBadge({
  project,
  fallbackLabel,
}: ProjectStatusBadgeProps) {
  const label =
    project.statusBadge?.label ||
    fallbackLabel ||
    (project.hasDesignIntent ? "In progress" : "Draft · Design intent");

  const type =
    project.statusBadge?.type ||
    (label.includes("needs you")
      ? "warning"
      : label.includes("Completed") || project.status === "ACTIVE"
      ? "ready"
      : "in-progress");

  if (type === "warning" || label.includes("needs you")) {
    return (
      <div className="h-[22px] px-2 flex items-center justify-center rounded-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 text-xs font-medium shrink-0">
        {label}
      </div>
    );
  }

  if (type === "ready" || label.includes("Completed")) {
    return (
      <div className="h-[22px] px-2 flex items-center justify-center rounded-[10px] bg-primary-subtle text-primary-text text-xs font-medium shrink-0">
        {label}
      </div>
    );
  }

  return (
    <div className="h-[22px] px-2 flex items-center justify-center rounded-[10px] bg-secondary text-secondary-foreground text-xs font-medium shrink-0">
      {label}
    </div>
  );
}

export interface CYCProjectCardProps {
  project: ProjectWithRole;
}

export function CYCProjectCard({ project }: CYCProjectCardProps) {
  // Format platform text
  const platformText =
    project.platforms && project.platforms.length > 0
      ? project.platforms
          .map((p) =>
            p === "DESKTOP" ? "Desktop" : p === "MOBILE" ? "Mobile" : "Tablet"
          )
          .join(" · ")
      : "Desktop · Mobile";

  // Extract member initials from project.members if provided by Backend
  const memberInitials =
    project.members && project.members.length > 0
      ? project.members.map((m) => getInitials(m.name))
      : [];

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group bg-card border border-border shadow-xs hover:border-foreground/30 hover:shadow-sm transition-all flex flex-col rounded-[14px] overflow-hidden w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Thumbnail Placeholder:
          Figma annotation: ภาพ A/B ล่าสุด, platform, ชื่อ, คำอธิบาย และสมาชิก ไม่มีภาพจนกว่า AI จะสร้าง A/B ครั้งแรก */}
      <div className="h-[180px] w-full bg-accent/50 relative flex items-center justify-center overflow-hidden border-b border-border/40">
        {project.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.thumbnailUrl}
            alt={project.name}
            className="size-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground/50 text-xs font-medium">
            <HugeIcon icon={ComputerIcon} size={16} />
            <span>·</span>
            <HugeIcon icon={SmartPhone01Icon} size={16} />
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="p-6 flex flex-col gap-4 flex-1 justify-between">
        {/* Texts */}
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground font-normal">
            {platformText}
          </p>
          <h3 className="text-base font-semibold text-foreground leading-6 group-hover:underline line-clamp-1">
            {project.name}
          </h3>
          <p className="text-sm text-muted-foreground leading-5 line-clamp-2">
            {project.description || project.clientOrProduct}
          </p>
        </div>

        {/* Footer: Members & Status Badge */}
        <div className="flex items-center justify-between pt-2">
          {/* Member avatars */}
          <div className="flex items-center gap-1">
            {memberInitials.map((initials, idx) => (
              <div
                key={idx}
                className="size-6 rounded-[10px] bg-muted text-muted-foreground text-xs font-medium flex items-center justify-center select-none"
              >
                {initials}
              </div>
            ))}
          </div>

          {/* Status Badge */}
          <ProjectStatusBadge project={project} />
        </div>
      </div>
    </Link>
  );
}
