"use client";

import React from "react";
import { DashboardPreviewMode } from "@/contexts/workspace-context";
import { Layers } from "lucide-react";

export interface DashboardPreviewDockProps {
  currentMode: DashboardPreviewMode;
  onSelectMode: (mode: DashboardPreviewMode) => void;
}

const MODES: { id: DashboardPreviewMode; label: string; node: string }[] = [
  { id: "both", label: "Projects & Sessions", node: "221:3801" },
  { id: "projects-only", label: "Projects Only", node: "137:1589" },
  { id: "empty", label: "Empty State", node: "154:1198" },
  { id: "tester", label: "Tester (No WS)", node: "221:4357" },
];

export function DashboardPreviewDock({
  currentMode,
  onSelectMode,
}: DashboardPreviewDockProps) {
  return (
    <aside
      aria-label="Figma Wireframe Preview Switcher"
      className="fixed bottom-4 right-4 z-50 bg-background/95 backdrop-blur-md border border-border shadow-lg rounded-2xl p-1.5 flex items-center gap-1 transition-all"
    >
      <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-muted-foreground border-r border-border shrink-0">
        <Layers className="size-3.5 text-primary-text" />
        <span className="hidden md:inline">Figma Preview:</span>
      </div>

      <div className="flex items-center gap-1">
        {MODES.map((item) => {
          const isActive = currentMode === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectMode(item.id)}
              className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? "bg-foreground text-background shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              title={`Figma Node ${item.node}: ${item.label}`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
