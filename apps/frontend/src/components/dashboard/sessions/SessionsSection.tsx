"use client";

import React from "react";
import { UserSession } from "@/types/session";
import { SessionCard } from "./SessionCard";

export interface SessionsSectionProps {
  sessions: UserSession[];
  /**
   * "sidebar" -> 1-column sidebar alongside projects (Node 221:3801)
   * "grid" -> 3-column full-width grid on tester dashboard (Node 221:4357)
   */
  layout?: "sidebar" | "grid";
}

export function SessionsSection({
  sessions,
  layout = "sidebar",
}: SessionsSectionProps) {
  if (sessions.length === 0) return null;

  const isGrid = layout === "grid";

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
    </div>
  );
}
