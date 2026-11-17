"use client";

import React from "react";
import Link from "next/link";
import { ProjectWithRole } from "@/types/project";
import { Monitor, Smartphone } from "lucide-react";

export interface CYCProjectCardProps {
  project: ProjectWithRole;
  members?: string[];
}

export function CYCProjectCard({
  project,
  members = ["PW", "NT", "PK"],
}: CYCProjectCardProps) {
  // Format platform text
  const platformText =
    project.platforms && project.platforms.length > 0
      ? project.platforms
          .map((p) => (p === "DESKTOP" ? "Desktop" : p === "MOBILE" ? "Mobile" : "Tablet"))
          .join(" · ")
      : "Desktop · Mobile";

  // Format status badge
  const renderStatusBadge = () => {
    const label = project.statusBadge?.label || "In progress";

    if (label.includes("needs you") || project.statusBadge?.type === "warning") {
      return (
        <div className="h-[22px] px-2 flex items-center justify-center rounded-[10px] bg-[#ffedd5] text-[#c2410c] dark:bg-orange-950 dark:text-orange-300 text-xs font-medium shrink-0">
          {label}
        </div>
      );
    }

    if (label.includes("Completed")) {
      return (
        <div className="h-[22px] px-2 flex items-center justify-center rounded-[10px] bg-primary-subtle text-primary-text text-xs font-medium shrink-0">
          {label}
        </div>
      );
    }

    // Default neutral / secondary badge (Prompt & context, In testing, Draft · Design intent, etc.)
    return (
      <div className="h-[22px] px-2 flex items-center justify-center rounded-[10px] bg-secondary text-secondary-foreground text-xs font-medium shrink-0">
        {label}
      </div>
    );
  };

  return (
    <div className="group bg-card border border-border shadow-xs hover:border-foreground/30 hover:shadow-sm transition-all flex flex-col rounded-[14px] overflow-hidden w-full">
      {/* Thumbnail Placeholder:
          Figma annotation: ภาพ A/B ล่าสุด, platform, ชื่อ, คำอธิบาย และสมาชิก ไม่มีภาพจนกว่า AI จะสร้าง A/B ครั้งแรก */}
      <div className="h-[180px] w-full bg-accent/50 relative flex items-center justify-center overflow-hidden border-b border-border/40">
        <div className="flex items-center gap-2 text-muted-foreground/50 text-xs font-medium">
          <Monitor className="size-4" />
          <span>·</span>
          <Smartphone className="size-4" />
        </div>
      </div>

      {/* Card Body */}
      <div className="p-6 flex flex-col gap-4 flex-1 justify-between">
        {/* Texts */}
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground font-normal">
            {platformText}
          </p>
          <Link
            href={`/projects/${project.id}`}
            className="text-base font-semibold text-foreground leading-6 hover:underline line-clamp-1"
          >
            {project.name}
          </Link>
          <p className="text-sm text-muted-foreground leading-5 line-clamp-2">
            {project.description}
          </p>
        </div>

        {/* Footer: Members & Status Badge */}
        <div className="flex items-center justify-between pt-2">
          {/* Member avatars */}
          <div className="flex items-center gap-1">
            {members.map((initials, idx) => (
              <div
                key={idx}
                className="size-6 rounded-[10px] bg-muted text-muted-foreground text-xs font-medium flex items-center justify-center select-none"
              >
                {initials}
              </div>
            ))}
          </div>

          {/* Status Badge */}
          {renderStatusBadge()}
        </div>
      </div>
    </div>
  );
}
