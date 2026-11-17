"use client";

import React from "react";
import Link from "next/link";
import { FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DashboardEmptyStateProps {
  createProjectHref?: string;
}

export function DashboardEmptyState({
  createProjectHref = "/projects?new=true",
}: DashboardEmptyStateProps) {
  return (
    <div className="bg-cyc-bg-brand flex flex-col gap-6 items-center justify-center px-6 sm:px-10 py-16 sm:py-20 rounded-[14px] w-full text-center shadow-sm">
      {/* Icon: Folder with plus */}
      <div className="size-10 flex items-center justify-center text-white">
        <FolderPlus className="size-10 stroke-[1.5]" />
      </div>

      {/* Title & Subtitle */}
      <div className="flex flex-col gap-2 items-center text-white max-w-xl">
        <p className="font-heading font-medium text-2xl tracking-[-0.24px] text-white">
          No projects yet
        </p>
        <p className="text-base text-white/90 font-normal leading-relaxed">
          Create your first project to start testing A/B designs with real testers.
        </p>
      </div>

      {/* Action Button: Lime green New Project */}
      <Button
        asChild
        className="rounded-[10px] h-8 px-3 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
      >
        <Link href={createProjectHref}>New project</Link>
      </Button>
    </div>
  );
}
