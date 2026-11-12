"use client";

import React from "react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, User as UserIcon } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Building03Icon, Ticket01Icon } from "@hugeicons/core-free-icons";

export default function DashboardPage() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const initials = (user.name || user.email)
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground text-center">
          Welcome, {user.name}. How do you want to start?
        </h1>
        <p className="text-muted-foreground mt-1 text-center">
          You can do both later. Your role is set separately in each project.
        </p>
      </div>
      <div className="flex flex-row gap-6">
        <Card className="w-full">
          <CardHeader>
            <div
              aria-hidden="true"
              className="mb-2 flex size-10 items-center justify-center rounded-full bg-primary-subtle text-primary-text"
            >
              <HugeiconsIcon icon={Building03Icon} />
            </div>
            <CardTitle>Create a workspace</CardTitle>
            <CardDescription>
              For designers and teams who run tests and invite clients, developers or project managers.
            </CardDescription>
            <Button className="shrink-0 border-primary-300 bg-primary font-semibold text-primary-text hover:bg-primary-200 hover:text-primary-text dark:border-primary-800 dark:hover:bg-primary-900">Create Workspace</Button>
          </CardHeader>
        </Card>
        <Card className="w-full">
          <CardHeader>
            <div
              aria-hidden="true"
              className="mb-2 flex size-10 items-center justify-center rounded-full bg-primary-subtle text-primary-text"
            >
              <HugeiconsIcon icon={Ticket01Icon} />
            </div>
            <CardTitle>Join testing session with a code</CardTitle>
            <CardDescription>
              A designer sent you a session code or link to test a design. No workspace needed.
            </CardDescription>
            <Button className="shrink-0 border-primary-300 bg-primary-subtle font-semibold text-primary-text hover:bg-primary-200 hover:text-primary-text dark:border-primary-800 dark:hover:bg-primary-900">Join Session</Button>
          </CardHeader>
        </Card>
      </div>

      {/* 
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
                {user.emailVerified ? (
                  <span className="inline-flex items-center mt-1 text-xs text-primary font-medium">
                    ✓ Email Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center mt-1 text-xs text-amber-500 font-medium">
                    ⚠ Email Unverified
                  </span>
                )}
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
      </Card> */}
    </div>
  );
}
