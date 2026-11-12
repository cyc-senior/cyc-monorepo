"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Navbar } from "@/components/layout/Navbar";
import { Loader2 } from "lucide-react";

/**
 * Protected dashboard shell with session guard and navigation header.
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

  const navbarUser = {
    name: user.name || user.email,
    email: user.email,
    avatarUrl: user.image || undefined,
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar variant="default" user={navbarUser} onSignOut={logout} />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        {children}
      </main>
    </div>
  );
}

