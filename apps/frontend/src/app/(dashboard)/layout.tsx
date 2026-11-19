"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { WorkspaceProvider, useWorkspace } from "@/contexts/workspace-context";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SidebarHeader } from "@/components/layout/SidebarHeader";
import { MinimalNav } from "@/components/layout/MinimalNav";

function DashboardShell({ children }: { children: React.ReactNode }) {
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

  const showSidebar = !hasNoWorkspace && !isPreWorkspaceRoute;

  return (
    <div className="min-h-screen flex bg-background">
      {showSidebar && <AppSidebar collapsed={sidebarCollapsed} />}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {showSidebar ? (
          <SidebarHeader
            onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
          />
        ) : (
          <MinimalNav />
        )}
        <main className="flex-1 overflow-y-auto w-full">{children}</main>
      </div>
    </div>
  );
}

/**
 * Protected dashboard shell with session guard and workspace context.
 * Always renders children uniformly so Next.js static prerender
 * validates child route segments without dropping.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/signin");
    }
  }, [isLoading, user, router]);

  return (
    <WorkspaceProvider>
      <DashboardShell>{children}</DashboardShell>
    </WorkspaceProvider>
  );
}
