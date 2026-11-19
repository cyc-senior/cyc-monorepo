"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { WorkspaceProvider, useWorkspace } from "@/contexts/workspace-context";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SidebarHeader } from "@/components/layout/SidebarHeader";
import { MinimalNav } from "@/components/layout/MinimalNav";
import { Loader2 } from "lucide-react";
import type { Workspace } from "@/types/workspace";

function InnerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { workspaces, isLoading: workspaceLoading } = useWorkspace();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

  // Active workspace state: 256px collapsible AppSidebar
  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar collapsed={sidebarCollapsed} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <SidebarHeader
          onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
        />
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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <WorkspaceProvider initialWorkspaces={initialWorkspaces}>
      <InnerShell>{children}</InnerShell>
    </WorkspaceProvider>
  );
}
