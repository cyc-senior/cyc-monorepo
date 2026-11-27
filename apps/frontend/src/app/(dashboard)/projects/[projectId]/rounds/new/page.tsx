"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

/**
 * Old Review prompt links (`/rounds/new?storyId=…`) now live at
 * `/stories/{storyId}/prompt`.
 */
function LegacyReviewPromptRedirect() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const storyId = useSearchParams().get("storyId");

  React.useEffect(() => {
    router.replace(
      storyId
        ? `/projects/${projectId}/stories/${storyId}/prompt`
        : `/projects/${projectId}/stories`
    );
  }, [storyId, projectId, router]);

  return null;
}

export default function LegacyReviewPromptPage() {
  return (
    <React.Suspense fallback={null}>
      <LegacyReviewPromptRedirect />
    </React.Suspense>
  );
}
