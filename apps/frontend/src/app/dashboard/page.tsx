"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, LogOut, User as UserIcon } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();

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

  const initials = (user.name || user.email)
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar variant="default" user={navbarUser} onSignOut={logout} />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Welcome back to CYC testing platform.
            </p>
          </div>

          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-primary" />
                Profile Details
              </CardTitle>
              <CardDescription>
                Your authenticated account information.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg bg-muted/40 border border-border">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14 border border-border">
                    {user.image && (
                      <AvatarImage src={user.image} alt={user.name || user.email} />
                    )}
                    <AvatarFallback className="text-base font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-foreground text-lg">
                      {user.name || "CYC User"}
                    </h3>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <span className="inline-flex items-center mt-1 text-xs text-primary font-medium">
                      ✓ Email Verified
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={logout}
                  className="flex items-center gap-2 text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

