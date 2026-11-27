"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { UserStoryForm } from "@/components/projects/UserStoryForm";

/** Old links (`/stories/new?storyId=…`) open the story's own page. */
function NewUserStoryContent() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const legacyStoryId = useSearchParams().get("storyId");

  React.useEffect(() => {
    if (legacyStoryId) router.replace(`/projects/${projectId}/stories/${legacyStoryId}`);
  }, [legacyStoryId, projectId, router]);

  if (legacyStoryId) return null;
  return <UserStoryForm projectId={projectId} storyId={null} />;
}

export default function NewUserStoryPage() {
  return (
    <React.Suspense
      fallback={
        <div className="w-full max-w-7xl mx-auto px-6 sm:px-10 py-12 text-center text-muted-foreground">
          Loading user story form...
        </div>
      }
    >
      <NewUserStoryContent />
    </React.Suspense>
  );
}
