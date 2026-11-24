"use client";

import React from "react";
import { ProjectMainLandingView } from "@/components/projects/ProjectMainLandingView";

export default function ProjectMainLandingPage() {
  return (
    <React.Suspense
      fallback={
        <div className="w-full max-w-7xl mx-auto px-6 sm:px-10 py-12 text-center text-muted-foreground">
          Loading project...
        </div>
      }
    >
      <ProjectMainLandingView />
    </React.Suspense>
  );
}
