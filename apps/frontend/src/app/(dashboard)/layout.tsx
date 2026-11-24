"use client";

import React, { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { WorkspaceProvider, useWorkspace } from "@/contexts/workspace-context";
import { BreadcrumbProvider } from "@/contexts/breadcrumb-context";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SidebarHeader } from "@/components/layout/SidebarHeader";
import { MinimalNav } from "@/components/layout/MinimalNav";
import { consumeReturnTo, rememberReturnTo } from "@/lib/return-to";

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
        <main className="flex-1 overflow-y-auto w-full">
          <Suspense
            fallback={
              <div className="w-full flex justify-center py-24">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
              </div>
            }
          >
            {children}
          </Suspense>
        </main>
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
  return (
    <WorkspaceProvider>
      <BreadcrumbProvider>
        {/* The guard reads the URL, which is only known at request time. */}
        <Suspense fallback={null}>
          <SessionGuard />
        </Suspense>
        <DashboardShell>{children}</DashboardShell>
      </BreadcrumbProvider>
    </WorkspaceProvider>
  );
}

/** Sends signed-out visitors to sign in and back here afterwards. */
function SessionGuard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      // Come back here after signing in, whichever way that happens.
      rememberReturnTo(`${pathname}${window.location.search}`);
      router.replace("/signin");
    } else if (pathname === "/dashboard") {
      // Google sign-in always lands on /dashboard: continue to the remembered page.
      const returnTo = consumeReturnTo();
      if (returnTo) router.replace(returnTo);
    }
  }, [isLoading, user, router, pathname]);

  return null;
}
