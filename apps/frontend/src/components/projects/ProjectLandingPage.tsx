"use client";

import React from "react";
import { ProjectMainLandingView } from "@/components/projects/ProjectMainLandingView";

/**
 * A project's landing page (overview and its tabs). The view reads the URL's
 * search params, so it renders inside a Suspense boundary.
 */
export function ProjectLandingPage({
  initialTab,
}: {
  initialTab?: React.ComponentProps<typeof ProjectMainLandingView>["initialTab"];
}) {
  return (
    <React.Suspense
      fallback={
        <div className="w-full max-w-7xl mx-auto px-6 sm:px-10 py-12 text-center text-muted-foreground">
          Loading project...
        </div>
      }
    >
      <ProjectMainLandingView initialTab={initialTab} />
    </React.Suspense>
  );
}
