"use client";

import * as React from "react";
import Link from "next/link";
import { PanelLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface SidebarHeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  onToggleSidebar?: () => void;
}

export function SidebarHeader({
  breadcrumbs = [{ label: "Projects", href: "/projects" }],
  onToggleSidebar,
}: SidebarHeaderProps) {
  return (
    <header className="h-14 border-b px-4 flex items-center gap-3 bg-background shrink-0">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={onToggleSidebar}
        title="Toggle sidebar"
      >
        <PanelLeft className="h-4 w-4" />
        <span className="sr-only">Toggle sidebar</span>
      </Button>

      <div className="h-4 w-px bg-border" />

      <nav className="flex items-center gap-1.5 text-sm">
        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          return (
            <React.Fragment key={idx}>
              {idx > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
              {crumb.href && !isLast ? (
                <Link
                  href={crumb.href}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="font-semibold text-foreground">
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          );
        })}
      </nav>
    </header>
  );
}
