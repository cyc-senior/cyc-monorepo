"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { WorkspaceProvider, useWorkspace } from "@/contexts/workspace-context";
import { SidebarProvider, useSidebar } from "@/contexts/sidebar-context";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SidebarHeader } from "@/components/layout/SidebarHeader";
import { MinimalNav } from "@/components/layout/MinimalNav";
import { HugeIcon } from "@/components/ui/huge-icon";
import { Loading03Icon } from "@hugeicons/core-free-icons";
import type { Workspace } from "@/types/workspace";

function InnerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { workspaces, isLoading: workspaceLoading } = useWorkspace();
  const { mode } = useSidebar();
  const [prevMode, setPrevMode] = useState(mode);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [overlayPinned, setOverlayPinned] = useState(false);
  const [overlayHovered, setOverlayHovered] = useState(false);

  const isOverlayMode = mode === "overlay";

  if (mode !== prevMode) {
    setPrevMode(mode);
    setOverlayPinned(false);
    setOverlayHovered(false);
  }

  const hasNoWorkspace = !workspaceLoading && workspaces.length === 0;
  const isPreWorkspaceRoute =
    pathname === "/first-run" || pathname === "/workspaces/new";

  useEffect(() => {
    if (!workspaceLoading) {
      if (workspaces.length === 0 && !isPreWorkspaceRoute) {
        router.replace("/first-run");
      } else if (workspaces.length > 0 && pathname === "/first-run") {
        router.replace("/projects");
      }
    }
  }, [workspaceLoading, workspaces.length, isPreWorkspaceRoute, pathname, router]);

  // Pre-workspace state (Screen 6 First run & Screen 8 Create workspace):
  // NO sidebar, NO breadcrumbs, minimal top nav with logo & account menu
  if (hasNoWorkspace || isPreWorkspaceRoute) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <MinimalNav />
        <main className="flex-1 overflow-y-auto w-full">{children}</main>
      </div>
    );
  }

  const handleToggleSidebar = () => {
    if (isOverlayMode) {
      setOverlayPinned((prev) => !prev);
      setOverlayHovered(false);
    } else {
      setSidebarCollapsed((prev) => !prev);
    }
  };

  return (
    <div className="min-h-screen flex bg-background relative">
      {isOverlayMode ? (
        overlayPinned ? (
          <AppSidebar collapsed={false} />
        ) : (
          <>
            <div
              onMouseEnter={() => setOverlayHovered(true)}
              className="fixed inset-y-0 left-0 z-40 w-3"
              aria-hidden="true"
            />
            {overlayHovered && (
              <div
                onMouseLeave={() => setOverlayHovered(false)}
                className="fixed inset-y-0 left-0 z-50 shadow-2xl"
              >
                <AppSidebar collapsed={false} />
              </div>
            )}
          </>
        )
      ) : (
        <AppSidebar collapsed={sidebarCollapsed} />
      )}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <SidebarHeader onToggleSidebar={handleToggleSidebar} />
        <main className="flex-1 overflow-y-auto w-full">{children}</main>
      </div>
    </div>
  );
}

interface DashboardShellProps {
  initialWorkspaces: Workspace[];
  children: React.ReactNode;
}

export function DashboardShell({
  initialWorkspaces,
  children,
}: DashboardShellProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/signin");
    }
  }, [isLoading, user, router]);

  if (isLoading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <HugeIcon icon={Loading03Icon} size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <WorkspaceProvider initialWorkspaces={initialWorkspaces}>
      <SidebarProvider>
        <InnerShell>{children}</InnerShell>
      </SidebarProvider>
    </WorkspaceProvider>
  );
}
