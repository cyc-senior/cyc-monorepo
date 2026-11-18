"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { WorkspaceProvider } from "@/contexts/workspace-context";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SidebarHeader } from "@/components/layout/SidebarHeader";
import { Loader2 } from "lucide-react";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

/**
 * Protected dashboard shell with session guard, workspace context, and Hi-fi v2 Sidebar layout.
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

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <WorkspaceProvider>
      <DashboardShell>{children}</DashboardShell>
    </WorkspaceProvider>
  );
}
