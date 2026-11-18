"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { WorkspaceProvider, useWorkspace } from "@/contexts/workspace-context";
import { Navbar, NavbarUser } from "@/components/layout/Navbar";
import { Loader2 } from "lucide-react";

function DashboardShell({
  user,
  onSignOut,
  children,
}: {
  user: NavbarUser;
  onSignOut: () => void;
  children: React.ReactNode;
}) {
  const { isTester } = useWorkspace();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar
        variant="default"
        user={user}
        onSignOut={onSignOut}
        hideWorkspaceLinks={isTester}
      />
      <main className="flex-1 flex flex-col w-full">{children}</main>
    </div>
  );
}

/**
 * Protected dashboard shell with session guard, workspace context, and navigation header.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, logout } = useAuth();
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

  const navbarUser: NavbarUser = {
    name: user.name || user.email,
    email: user.email,
    avatarUrl: user.image || undefined,
  };

  return (
    <WorkspaceProvider>
      <DashboardShell user={navbarUser} onSignOut={logout}>
        {children}
      </DashboardShell>
    </WorkspaceProvider>
  );
}
