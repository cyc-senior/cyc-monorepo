"use client";

import { useParams } from "next/navigation";
import { UserStoryForm } from "@/components/projects/UserStoryForm";

/** Edit a user story and its Scope: `/projects/{projectId}/stories/{storyId}`. */
export default function EditUserStoryPage() {
  const params = useParams();
  return (
    <UserStoryForm
      key={params.storyId as string}
      projectId={params.projectId as string}
      storyId={params.storyId as string}
    />
  );
}
