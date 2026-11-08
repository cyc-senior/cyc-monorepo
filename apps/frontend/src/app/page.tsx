"use client";

import * as React from "react";
import Link from "next/link";
import { Navbar, type NavbarUser } from "@/components/navbar";
import { Button } from "@/components/ui/button";

const MOCK_USER: NavbarUser = {
  name: "Alex Morgan",
  email: "alex.morgan@company.com",
  avatarUrl:
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
};

export default function Home() {
  const [user, setUser] = React.useState<NavbarUser | null>(MOCK_USER);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navbar with 40px left/right padding */}
      <Navbar
        variant="default"
        user={user}
        onSignOut={() => setUser(null)}
      />

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12 flex flex-col gap-8">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">
            CYC Demo &amp; Navigation
          </h1>
          <p className="text-muted-foreground">
            Test the responsive navbar variants, sign in, sign up, and OTP verification flows.
          </p>
        </div>

        {/* Demo Controls */}
        <div className="p-6 rounded-xl border border-border bg-card space-y-5 shadow-sm">
          <h2 className="text-lg font-semibold">Interactive Controls</h2>

          <div className="flex flex-wrap gap-3 items-center">
            <span className="text-sm text-muted-foreground">Navbar Variant:</span>
            {user ? (
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={() => setUser(null)}
              >
                Simulate Log Out
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={() => setUser(MOCK_USER)}
              >
                Simulate Log In (Alex Morgan)
              </Button>
            )}
          </div>

          <div className="border-t border-border pt-4 flex flex-wrap gap-3 items-center">
            <span className="text-sm text-muted-foreground">Auth Routes:</span>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/signin">Sign In</Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/signin?session_code=alpha-42">Sign In (?session_code)</Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/signup">Sign Up</Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/signup?session_code=alpha-42">Sign Up (?session_code)</Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/forgot-password">Forgot Password</Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/privacy">Privacy Notice</Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/terms">Terms of Use</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
