"use client";

import { useParams, useRouter } from "next/navigation";
import { StepProgress } from "@/components/wizard/StepProgress";
import { TeamRolesForm } from "@/components/projects/TeamRolesForm";

/** Step 3 of the new-project wizard. Managing the team later happens at /team. */
export default function TeamRolesSetupPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      <StepProgress
        currentStep={3}
        stepLabel="Step 3 of 3"
        title="Team & roles"
        description="Add team members who will collaborate on, review, or develop designs for this project."
      />
      <TeamRolesForm
        projectId={projectId}
        mode="setup"
        backHref={`/projects/${projectId}/setup/intent`}
        onFinish={() => router.push(`/projects/${projectId}`)}
      />
    </div>
  );
}
