import type { AuditLogItem } from "@/lib/project-client";
import { getGenerationJob, getVariant } from "@/lib/generation-client";

/** "just now", "5 min ago", "3 h ago", "2 d ago", then the date. */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} h ago`;
  if (diffDays < 7) return `${diffDays} d ago`;
  return date.toLocaleDateString();
}

export interface ActivityButton {
  label: string;
  /** Known link, or… */
  href?: string;
  /** …a link that needs a lookup first (e.g. which round a variant is in). */
  resolve?: () => Promise<string>;
}

function designLinks(projectId: string) {
  const refine = (roundId: string) => `/projects/${projectId}/rounds/${roundId}/refine`;
  const progress = (roundId: string, jobId: string) =>
    `/projects/${projectId}/rounds/${roundId}/generate?job=${jobId}`;
  return { refine, progress };
}

export function getActivityButton(log: AuditLogItem, projectId: string): ActivityButton | null {
  const { refine, progress } = designLinks(projectId);
  const roundId = typeof log.changes?.roundId === "string" ? log.changes.roundId : null;

  // Generated designs: open them, or the generation's progress page.
  if (log.entityType === "GenerationJob" && log.entityId) {
    const refinement =
      log.changes?.refinement === true || Boolean(log.changes?.body?.baseVariantId);
    if (log.action === "GenerationJob.complete" && roundId) {
      return { label: "Refine", href: refine(roundId) };
    }
    // Refinements show their progress in the Refine page's chat; only the
    // first A/B generation has its own Generating page.
    if (refinement && roundId) {
      return { label: "View", href: refine(roundId) };
    }
    if ((log.action === "GenerationJob.fail" || log.action === "GenerationJob.start") && roundId) {
      return { label: "View", href: progress(roundId, log.entityId) };
    }
    const jobId = log.entityId;
    return {
      label: "View",
      resolve: async () => {
        const job = await getGenerationJob(projectId, jobId);
        if (job.status === "CANCELLED") {
          const storyId = job.inputSnapshot?.stories?.[0]?.id;
          return storyId ? `/projects/${projectId}/rounds/new?storyId=${storyId}` : `/projects/${projectId}`;
        }
        return job.status === "SUCCEEDED" || job.baseVariantId
          ? refine(job.roundId)
          : progress(job.roundId, job.id);
      },
    };
  }
  if (log.entityType === "UIVariant" && log.entityId && log.action !== "UIVariant.delete") {
    const variantId = log.entityId;
    return {
      label: "Preview",
      resolve: async () => refine((await getVariant(projectId, variantId)).roundId),
    };
  }
  if (log.action.startsWith("FeedbackTheme") || log.action.includes("cancel") || log.action.includes("reject")) {
    return {
      label: "Step in",
      href: `/projects/${projectId}/sessions`,
    };
  }
  if (log.entityType === "UserStory") {
    return {
      label: "View",
      href: `/projects/${projectId}/stories`,
    };
  }
  if (log.entityType === "TestSession") {
    return {
      label: "View",
      href: `/projects/${projectId}/sessions`,
    };
  }
  if (log.entityType === "Report") {
    return {
      label: "View",
      href: `/projects/${projectId}/reports`,
    };
  }
  if (log.entityType === "DesignIntent") {
    return {
      label: "View",
      href: `/projects/${projectId}/setup/intent`,
    };
  }
  return null;
}
