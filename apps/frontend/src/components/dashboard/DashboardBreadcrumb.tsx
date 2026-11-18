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
import { Workspace } from "@/contexts/workspace-context";

export type { Workspace };

export interface DashboardBreadcrumbProps {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  onSelectWorkspace: (ws: Workspace) => void;
  currentPage?: string;
}

export function DashboardBreadcrumb({
  workspaces,
  currentWorkspace,
  onSelectWorkspace,
  currentPage = "Home",
}: DashboardBreadcrumbProps) {
  const initialLetter = currentWorkspace?.name
    ? currentWorkspace.name.charAt(0).toUpperCase()
    : "W";

  return (
    <div className="w-full border-b border-border bg-background px-6 lg:px-20 h-11 flex items-center justify-between">
      {/* Left: Breadcrumbs path */}
      <div className="flex items-center gap-2">
        {/* Workspace Mark: Single letter square or picture thumbnail */}
        <div className="flex size-6 items-center justify-center rounded-[6px] overflow-hidden bg-muted text-muted-foreground text-xs font-semibold shrink-0 select-none border border-border/80">
          {currentWorkspace?.avatarUrl ? (
            <img
              src={currentWorkspace.avatarUrl}
              alt={currentWorkspace.name}
              className="size-full object-cover rounded-[6px]"
            />
          ) : (
            <span>{initialLetter}</span>
          )}
        </div>

        {/* Workspace Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none font-normal"
            >
              <span>{currentWorkspace?.name || "Select workspace"}</span>
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
                <div className="flex size-5 items-center justify-center rounded-[4px] overflow-hidden bg-muted text-[11px] font-semibold shrink-0">
                  {ws.avatarUrl ? (
                    <img
                      src={ws.avatarUrl}
                      alt={ws.name}
                      className="size-full object-cover rounded-[4px]"
                    />
                  ) : (
                    <span>{ws.name.charAt(0).toUpperCase()}</span>
                  )}
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
        <span className="text-sm font-normal text-foreground">{currentPage}</span>
      </div>
    </div>
  );
}
