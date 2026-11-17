"use client";

import React from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Workspace, DashboardPreviewMode } from "@/contexts/workspace-context";

export type { Workspace, DashboardPreviewMode };

export interface DashboardBreadcrumbProps {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  onSelectWorkspace: (ws: Workspace) => void;
  previewMode?: DashboardPreviewMode;
  onPreviewModeChange?: (mode: DashboardPreviewMode) => void;
}

export function DashboardBreadcrumb({
  workspaces,
  currentWorkspace,
  onSelectWorkspace,
  previewMode,
  onPreviewModeChange,
}: DashboardBreadcrumbProps) {
  const initialLetter = currentWorkspace?.name
    ? currentWorkspace.name.charAt(0).toUpperCase()
    : "W";

  return (
    <div className="w-full border-b border-border bg-background px-6 lg:px-20 h-11 flex items-center justify-between">
      {/* Left: Breadcrumbs path */}
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
              <span>{currentWorkspace?.name || "Workspace"}</span>
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
                onClick={() => onSelectWorkspace(ws)}
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

        {/* Breadcrumb Separator */}
        <ChevronRight className="size-3.5 text-muted-foreground/60 shrink-0" />

        {/* Active Page Indicator */}
        <span className="text-sm font-medium text-foreground">Home</span>
      </div>

      {/* Right: Figma Preview Switcher (4 Hi-Fi wireframes from Figma) */}
      {previewMode && onPreviewModeChange && (
        <div className="hidden sm:flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => onPreviewModeChange("both")}
            className={`px-2 py-1 rounded-md font-medium transition-colors cursor-pointer ${
              previewMode === "both"
                ? "bg-background text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Projects & Sessions (221:3801)
          </button>
          <button
            type="button"
            onClick={() => onPreviewModeChange("projects-only")}
            className={`px-2 py-1 rounded-md font-medium transition-colors cursor-pointer ${
              previewMode === "projects-only"
                ? "bg-background text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Projects Only (137:1589)
          </button>
          <button
            type="button"
            onClick={() => onPreviewModeChange("empty")}
            className={`px-2 py-1 rounded-md font-medium transition-colors cursor-pointer ${
              previewMode === "empty"
                ? "bg-background text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Empty (154:1198)
          </button>
          <button
            type="button"
            onClick={() => onPreviewModeChange("tester")}
            className={`px-2 py-1 rounded-md font-medium transition-colors cursor-pointer ${
              previewMode === "tester"
                ? "bg-background text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Tester (221:4357)
          </button>
        </div>
      )}
    </div>
  );
}
