"use client";

import { useParams, useRouter } from "next/navigation";
import { StepProgress } from "@/components/wizard/StepProgress";
import { DesignIntentForm } from "@/components/projects/DesignIntentForm";

/** Step 2 of the new-project wizard. Editing later happens at /intent. */
export default function DesignIntentSetupPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  return (
    <div className="p-6 sm:p-10 space-y-8">
      <StepProgress
        currentStep={2}
        stepLabel="STEP 2 OF 3"
        stepName="DESIGN INTENT"
        title="Design intent"
        description="AI uses this for every A/B it builds in this project. You can change it later."
      />
      <DesignIntentForm
        projectId={projectId}
        mode="setup"
        backHref={`/projects/${projectId}`}
        onSaved={() => router.push(`/projects/${projectId}/setup/team`)}
      />
    </div>
  );
}
