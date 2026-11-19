"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { WorkspaceProvider, useWorkspace } from "@/contexts/workspace-context";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SidebarHeader } from "@/components/layout/SidebarHeader";
import { MinimalNav } from "@/components/layout/MinimalNav";
import { Loader2 } from "lucide-react";

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
      {/* Pre-workspace Top Nav */}
      {!showSidebar && (
        <div className="w-full flex flex-col min-h-screen">
          <MinimalNav />
          <main className="flex-1 overflow-y-auto w-full">{children}</main>
        </div>
      )}

      {/* Active workspace state: 256px collapsible AppSidebar */}
      {showSidebar && (
        <>
          <AppSidebar collapsed={sidebarCollapsed} />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <SidebarHeader
              onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
            />
            <main className="flex-1 overflow-y-auto w-full">{children}</main>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Protected dashboard shell with session guard and workspace context.
 * Always renders children in the DOM tree so Next.js static prerender
 * can validate the child route segments without dropping.
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
      {isLoading || !user ? (
        <div className="relative">
          <div className="flex min-h-screen items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <div className="hidden">{children}</div>
        </div>
      ) : (
        <DashboardShell>{children}</DashboardShell>
      )}
    </WorkspaceProvider>
  );
}
