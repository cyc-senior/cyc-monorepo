"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ProjectRole } from "@/types/project";
import { HugeIcon } from "@/components/ui/huge-icon";
import { SidebarLeft01Icon } from "@hugeicons/core-free-icons";
import { useBreadcrumbs } from "@/contexts/breadcrumb-context";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const ROLE_LABELS: Record<ProjectRole, string> = {
  DESIGNER: "Designer",
  PROJECT_MANAGER: "Project manager",
  PRODUCT_OWNER: "Product owner",
  DEVELOPER: "Developer",
  CLIENT: "Client",
};

interface SidebarHeaderProps {
  onToggleSidebar?: () => void;
}

export function SidebarHeader({ onToggleSidebar }: SidebarHeaderProps) {
  const pathname = usePathname();
  const { customSegments, project } = useBreadcrumbs();

  // Compute breadcrumb segments based on route and project state
  const segments = React.useMemo(() => {
    if (customSegments && customSegments.length > 0) {
      return customSegments;
    }

    // Default route-based breadcrumb matching Figma
    if (pathname === "/projects") {
      return [{ label: "Projects" }];
    }
    if (pathname === "/projects/new") {
      return [
        { label: "Projects", href: "/projects" },
        { label: "New project" },
      ];
    }
    if (pathname === "/sessions") {
      return [{ label: "Sessions" }];
    }
    if (pathname === "/reports") {
      return [{ label: "Reports" }];
    }

    // Project sub-routes: /projects/[projectId]/...
    const projectMatch = pathname.match(/^\/projects\/([a-zA-Z0-9-]+)(\/.*)?$/);
    if (projectMatch && projectMatch[1] !== "new") {
      const projectId = projectMatch[1];
      const subpath = projectMatch[2] || "";
      const projectName = project?.name || "Project";

      if (!subpath || subpath === "") {
        // Screen 14 & 14A: overview
        return [{ label: projectName }];
      }
      if (subpath.startsWith("/setup")) {
        // Screen 12 & 13: Setup
        return [
          { label: projectName, href: `/projects/${projectId}` },
          { label: "Setup" },
        ];
      }
      if (subpath.startsWith("/stories/new")) {
        // Screen 15: New user story
        return [
          { label: projectName, href: `/projects/${projectId}` },
          { label: "New user story" },
        ];
      }
      if (subpath.startsWith("/rounds/new")) {
        // Screen 16: Review structured prompt
        return [
          { label: projectName, href: `/projects/${projectId}` },
          { label: "Review structured prompt" },
        ];
      }

      return [
        { label: projectName, href: `/projects/${projectId}` },
        { label: "Overview" },
      ];
    }

    return [{ label: "Projects", href: "/projects" }];
  }, [pathname, customSegments, project]);

  return (
    <header className="h-14 border-b px-4 flex items-center gap-3 bg-background shrink-0 text-foreground">
      {/* Sidebar Trigger */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
        onClick={onToggleSidebar}
        title="Toggle sidebar"
      >
        <HugeIcon icon={SidebarLeft01Icon} size={18} />
        <span className="sr-only">Toggle sidebar</span>
      </Button>

      {/* Separator from Figma Header */}
      <div className="w-[1px] h-4 bg-border shrink-0" aria-hidden="true" />

      {/* Breadcrumb matching Figma */}
      <Breadcrumb className="truncate">
        <BreadcrumbList className="text-sm">
          {segments.map((seg, idx) => {
            const isLast = idx === segments.length - 1;
            return (
              <React.Fragment key={idx}>
                {idx > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem className="truncate">
                  {isLast || !seg.href ? (
                    <BreadcrumbPage className="truncate max-w-[240px]">
                      {seg.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild className="truncate max-w-[200px]">
                      <Link href={seg.href}>{seg.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>

      {/* The viewer's role on the open project (Figma header badge) */}
      {project?.role && pathname.startsWith(`/projects/${project.id}`) && (
        <Badge variant="outline" className="ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold">
          {ROLE_LABELS[project.role] ?? project.role}
        </Badge>
      )}
    </header>
  );
}
