"use client";

import { useParams, useRouter } from "next/navigation";
import { TeamRolesForm } from "@/components/projects/TeamRolesForm";

/** Manage the project's team (no wizard progress or footer). */
export default function TeamRolesPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-heading font-medium tracking-tight text-foreground">
          Team &amp; roles
        </h1>
        <p className="text-sm text-muted-foreground">
          Add team members who will collaborate on, review, or develop designs for this project.
        </p>
      </div>
      <TeamRolesForm
        projectId={projectId}
        mode="edit"
        backHref={`/projects/${projectId}`}
        onFinish={() => router.push(`/projects/${projectId}`)}
      />
    </div>
  );
}
