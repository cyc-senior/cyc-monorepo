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
