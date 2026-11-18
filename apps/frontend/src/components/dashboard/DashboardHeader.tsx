"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export interface DashboardHeaderProps {
  userName?: string;
  hasProjects?: boolean;
  isTester?: boolean;
}

export function DashboardHeader({
  userName,
  hasProjects = false,
  isTester = false,
}: DashboardHeaderProps) {
  const [greeting, setGreeting] = useState("Good day");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      setGreeting("Good morning");
    } else if (hour >= 12 && hour < 17) {
      setGreeting("Good afternoon");
    } else {
      setGreeting("Good evening");
    }
  }, []);

  const firstName = userName ? userName.split(" ")[0] : "Pannawit";

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="font-heading text-3xl sm:text-[36px] font-medium tracking-tight text-foreground leading-tight">
        {greeting}, {firstName}
      </h1>

      {/* Header action buttons */}
      {isTester ? (
        // Tester view (Figma Node 221:4357): "Join with code" and "Create workspace"
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            asChild
            className="rounded-[10px] h-8 px-2.5 text-sm font-medium border-border hover:bg-accent text-foreground cursor-pointer"
          >
            <Link href="/join">Join with code</Link>
          </Button>

          <Button
            variant="outline"
            asChild
            className="rounded-[10px] h-8 px-2.5 text-sm font-medium border-border hover:bg-accent text-foreground cursor-pointer"
          >
            <Link href="/create/workspace">Create workspace</Link>
          </Button>
        </div>
      ) : hasProjects ? (
        // Populated workspace view (Figma Node 137:1589 & 221:3801): "Join with code" and "New project"
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            asChild
            className="rounded-[10px] h-8 px-2.5 text-sm font-medium border-border hover:bg-accent cursor-pointer"
          >
            <Link href="/join">Join with code</Link>
          </Button>

          <Button
            asChild
            className="rounded-[10px] h-8 px-2.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
          >
            <Link href="/projects/new">New project</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
