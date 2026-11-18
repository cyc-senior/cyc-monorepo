"use client";

import React from "react";
import Link from "next/link";
import { UserSession } from "@/types/session";
import { Button } from "@/components/ui/button";

export interface SessionCardProps {
  session: UserSession;
}

export function SessionCard({ session }: SessionCardProps) {
  // Format subtitle according to Figma annotations:
  // - Active: "Round {n} of {m} · last active {time}"
  // - Scheduled: "Opens {date/time}"
  // - Completed: "Submitted {date} · {m} rounds"
  let subtitleText = "";
  if (session.status === "ACTIVE") {
    subtitleText = `Round ${session.currentRound || 1} of ${session.totalRounds || 5}${
      session.lastActiveTime ? ` · last active ${session.lastActiveTime}` : ""
    }`;
  } else if (session.status === "SCHEDULED") {
    subtitleText = `Opens ${session.opensAt || "Soon"}`;
  } else if (session.status === "COMPLETED") {
    subtitleText = `Submitted ${session.submittedAt || "Recently"}${
      session.totalRounds ? ` · ${session.totalRounds} rounds` : ""
    }`;
  }

  return (
    <div className="bg-card border border-border shadow-xs drop-shadow-[0px_1px_1.5px_rgba(0,0,0,0.1)] hover:border-foreground/30 hover:shadow-sm transition-all flex flex-col gap-4 p-6 rounded-[14px] w-full">
      {/* Session Title */}
      <h3 className="font-heading text-lg sm:text-[20px] font-medium text-foreground leading-7">
        {session.title}
      </h3>

      {/* Session Status Row */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground truncate">{subtitleText}</p>

        {/* Status Badge */}
        {session.status === "COMPLETED" ? (
          <div className="h-[22px] px-2 flex items-center justify-center rounded-[10px] bg-primary-subtle text-primary-text text-xs font-medium shrink-0">
            Completed
          </div>
        ) : session.status === "SCHEDULED" ? (
          <div className="h-[22px] px-2 flex items-center justify-center rounded-[10px] bg-secondary text-secondary-foreground text-xs font-medium shrink-0">
            Scheduled
          </div>
        ) : (
          <div className="h-[22px] px-2 flex items-center justify-center rounded-[10px] bg-secondary text-secondary-foreground text-xs font-medium shrink-0">
            Active
          </div>
        )}
      </div>

      {/* Continue Session Button: only shown when Active (Figma Node 221:4628) */}
      {session.status === "ACTIVE" && (
        <Button
          asChild
          className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 px-2.5 rounded-[10px] text-sm font-medium transition-colors w-fit flex items-center justify-center cursor-pointer mt-1"
        >
          <Link href={`/sessions/${session.id}`}>Continue session</Link>
        </Button>
      )}
    </div>
  );
}

export interface SessionsSectionProps {
  sessions: UserSession[];
  isLoading?: boolean;
  /**
   * "sidebar" -> 1-column sidebar alongside projects (Node 221:3801)
   * "grid" -> 3-column full-width grid on tester dashboard (Node 221:4357)
   */
  layout?: "sidebar" | "grid";
}

export function SessionsSection({
  sessions,
  isLoading = false,
  layout = "sidebar",
}: SessionsSectionProps) {
  const isGrid = layout === "grid";

  // In sidebar mode (alongside projects), hide section if user has no joined sessions
  if (!isGrid && !isLoading && sessions.length === 0) {
    return null;
  }

  return (
    <div
      className={`w-full flex flex-col gap-4 ${
        isGrid ? "" : "lg:w-[380px] xl:w-[400px] shrink-0"
      }`}
    >
      <div className="flex h-8 items-center justify-between">
        <h2 className="font-heading text-xl sm:text-[20px] font-medium text-foreground leading-7">
          My sessions
        </h2>
      </div>

      {isLoading ? (
        <div
          className={
            isGrid
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full"
              : "flex flex-col gap-4"
          }
        >
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-32 w-full rounded-[14px] border border-border bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-card border border-border rounded-[14px] p-8 flex flex-col items-center justify-center text-center gap-3">
          <p className="font-heading text-lg font-medium text-foreground">
            No testing sessions yet
          </p>
          <p className="text-sm text-muted-foreground max-w-md">
            Enter a session code from a designer to join a testing session, or create a workspace to start your own project.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <Button
              asChild
              className="rounded-[10px] h-8 px-3 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Link href="/join">Join with code</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={
            isGrid
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full"
              : "flex flex-col gap-4"
          }
        >
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}
