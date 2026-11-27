"use client";

import { useParams, useRouter } from "next/navigation";
import { DesignIntentForm } from "@/components/projects/DesignIntentForm";

/** Edit the project's design intent (no wizard progress). */
export default function DesignIntentPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  return (
    <div className="p-6 sm:p-10 space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-heading font-medium tracking-tight text-foreground">
          Design intent
        </h1>
        <p className="text-sm text-muted-foreground">
          AI uses this for every A/B it builds in this project. You can change it anytime.
        </p>
      </div>
      <DesignIntentForm
        projectId={projectId}
        mode="edit"
        backHref={`/projects/${projectId}`}
        onSaved={() => router.push(`/projects/${projectId}`)}
      />
    </div>
  );
}
