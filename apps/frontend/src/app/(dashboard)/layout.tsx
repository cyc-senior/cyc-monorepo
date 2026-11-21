"use client";

import React, { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { WorkspaceProvider, useWorkspace } from "@/contexts/workspace-context";
import { BreadcrumbProvider } from "@/contexts/breadcrumb-context";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SidebarHeader } from "@/components/layout/SidebarHeader";
import { MinimalNav } from "@/components/layout/MinimalNav";

function WorkspaceRedirectGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { workspaces, isLoading: workspaceLoading } = useWorkspace();
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

  return null;
}

function DashboardSidebarWrapper({
  collapsed,
}: {
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const { workspaces, isLoading: workspaceLoading } = useWorkspace();

  const hasNoWorkspace = !workspaceLoading && workspaces.length === 0;
  const isPreWorkspaceRoute =
    pathname === "/first-run" || pathname === "/workspaces/new";
  const showSidebar = !hasNoWorkspace && !isPreWorkspaceRoute;

  if (!showSidebar) return null;
  return <AppSidebar collapsed={collapsed} />;
}

function DashboardHeaderWrapper({
  onToggleSidebar,
}: {
  onToggleSidebar: () => void;
}) {
  const pathname = usePathname();
  const { workspaces, isLoading: workspaceLoading } = useWorkspace();

  const hasNoWorkspace = !workspaceLoading && workspaces.length === 0;
  const isPreWorkspaceRoute =
    pathname === "/first-run" || pathname === "/workspaces/new";
  const showSidebar = !hasNoWorkspace && !isPreWorkspaceRoute;

  if (showSidebar) {
    return <SidebarHeader onToggleSidebar={onToggleSidebar} />;
  }
  return <MinimalNav />;
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <Suspense fallback={null}>
        <WorkspaceRedirectGuard />
        <DashboardSidebarWrapper collapsed={sidebarCollapsed} />
      </Suspense>
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Suspense
          fallback={<div className="h-14 border-b bg-background shrink-0" />}
        >
          <DashboardHeaderWrapper
            onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
          />
        </Suspense>
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
      <BreadcrumbProvider>
        <DashboardShell>{children}</DashboardShell>
      </BreadcrumbProvider>
    </WorkspaceProvider>
  );
}
