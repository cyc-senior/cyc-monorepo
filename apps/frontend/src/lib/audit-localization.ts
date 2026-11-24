import { AuditLogItem } from "@/lib/project-client";

export interface LocalizedAuditItem {
  title: string;
  subtitle?: string;
  badge: string;
  iconType: "alert" | "tick" | "ai" | "view" | "generic";
}

/**
 * Exhaustive mapping of all backend @AuditEntity and @AuditAction combinations:
 * - Project.*
 * - ProjectMember.*
 * - DesignIntent.*
 * - UserPersona.*
 * - UserStory.*
 * - StoryGeneration.*
 * - DesignRound.*
 * - GenerationJob.*
 * - UIVariant.*
 * - TestSession.*
 * - FeedbackTheme.*
 * - FeedbackAnalysis.*
 * - SharedRound.*
 * - Report.*
 * - Workspace.*
 */
export function localizeAuditLog(log: AuditLogItem): LocalizedAuditItem {
  const body = (log.changes?.body as Record<string, unknown>) || {};
  const nameOrTitle = (body.title || body.name || body.email) as string | undefined;

  switch (log.action) {
    // Project
    case "Project.create":
      return {
        title: "Project created",
        subtitle: nameOrTitle ? `"${nameOrTitle}"` : undefined,
        badge: "Project",
        iconType: "tick",
      };
    case "Project.update":
      return {
        title: "Project settings updated",
        subtitle: nameOrTitle ? `"${nameOrTitle}"` : undefined,
        badge: "Project",
        iconType: "tick",
      };
    case "Project.delete":
      return {
        title: "Project deleted",
        badge: "Project",
        iconType: "alert",
      };

    // Project Members
    case "ProjectMember.create":
      return {
        title: "Team member invited",
        subtitle: (body.email as string) || undefined,
        badge: "Team",
        iconType: "tick",
      };
    case "ProjectMember.update":
      return {
        title: "Team member role changed",
        subtitle: (body.role as string) ? `Role: ${body.role}` : undefined,
        badge: "Team",
        iconType: "tick",
      };
    case "ProjectMember.delete":
      return {
        title: "Team member removed",
        badge: "Team",
        iconType: "alert",
      };

    // Design Intent
    case "DesignIntent.create":
    case "DesignIntent.update":
      return {
        title: "Design intent updated",
        subtitle: body.statement ? `"${body.statement}"` : undefined,
        badge: "Design intent",
        iconType: "tick",
      };

    // Personas
    case "UserPersona.create":
      return {
        title: "Persona created",
        subtitle: nameOrTitle ? `"${nameOrTitle}"` : undefined,
        badge: "Persona",
        iconType: "tick",
      };
    case "UserPersona.update":
      return {
        title: "Persona updated",
        subtitle: nameOrTitle ? `"${nameOrTitle}"` : undefined,
        badge: "Persona",
        iconType: "tick",
      };
    case "UserPersona.delete":
      return {
        title: "Persona deleted",
        badge: "Persona",
        iconType: "alert",
      };

    // User Stories
    case "UserStory.create":
      return {
        title: "User story created",
        subtitle: nameOrTitle ? `"${nameOrTitle}"` : undefined,
        badge: "US",
        iconType: "tick",
      };
    case "UserStory.update":
      return {
        title: "User story updated",
        subtitle: nameOrTitle ? `"${nameOrTitle}"` : undefined,
        badge: "US",
        iconType: "tick",
      };
    case "UserStory.delete":
      return {
        title: "User story removed",
        badge: "US",
        iconType: "alert",
      };

    // Story Generations
    case "StoryGeneration.create":
      return {
        title: "AI story generation started",
        badge: "AI",
        iconType: "ai",
      };
    case "StoryGeneration.cancel":
      return {
        title: "AI story generation cancelled",
        badge: "AI",
        iconType: "alert",
      };

    // Design Rounds
    case "DesignRound.create":
      return {
        title: "Design round started",
        subtitle: nameOrTitle ? `"${nameOrTitle}"` : undefined,
        badge: "Round",
        iconType: "tick",
      };
    case "DesignRound.update":
      return {
        title: "Design round updated",
        badge: "Round",
        iconType: "tick",
      };
    case "DesignRound.approve":
      return {
        title: "Design round approved",
        badge: "Round",
        iconType: "tick",
      };
    case "DesignRound.iterate":
      return {
        title: "Design iteration started",
        badge: "Iteration",
        iconType: "ai",
      };

    // AI Generation Jobs
    // Generation lifecycle: queued → working → ready | failed | cancelled.
    case "GenerationJob.create":
      return body.baseVariantId
        ? {
            title: "Design refinement queued",
            subtitle: typeof body.prompt === "string" ? `"${body.prompt}"` : undefined,
            badge: "AI",
            iconType: "ai",
          }
        : {
            title: "AI design generation queued",
            badge: "AI",
            iconType: "ai",
          };
    case "GenerationJob.start":
      return log.changes?.refinement
        ? {
            title: "AI is working on a new version",
            badge: "AI",
            iconType: "ai",
          }
        : {
            title: `AI is building ${Number(log.changes?.variantCount) === 1 ? "a design" : "A and B"}`,
            badge: "AI",
            iconType: "ai",
          };
    case "GenerationJob.cancel":
      return {
        title: "AI design generation cancelled",
        subtitle: typeof log.changes?.reason === "string" ? log.changes.reason : undefined,
        badge: "AI",
        iconType: "alert",
      };
    case "GenerationJob.complete": {
      // Recorded by the generation worker: { roundId, variantIds, refinement }.
      const changes = log.changes ?? {};
      const count = Array.isArray(changes.variantIds) ? changes.variantIds.length : 0;
      return changes.refinement
        ? {
            title: "New design version ready",
            subtitle: "Preview it and keep refining",
            badge: "AI",
            iconType: "ai",
          }
        : {
            title: count === 1 ? "AI design ready" : `${count || "A/B"} AI designs ready`,
            subtitle:
              Number(changes.failedVariants) > 0
                ? `${count} of ${count + Number(changes.failedVariants)} passed the design system and accessibility checks`
                : "Preview and refine them",
            badge: "AI",
            iconType: "ai",
          };
    }
    case "GenerationJob.fail":
      return {
        title: "AI design generation failed",
        subtitle: typeof log.changes?.error === "string" ? log.changes.error : undefined,
        badge: "AI",
        iconType: "alert",
      };

    // UI Variants
    case "UIVariant.create":
      return {
        title: "Design variant created",
        subtitle: nameOrTitle ? `"${nameOrTitle}"` : undefined,
        badge: "Variant",
        iconType: "ai",
      };
    case "UIVariant.update":
      return {
        title: "Design variant updated",
        badge: "Variant",
        iconType: "tick",
      };
    case "UIVariant.approve":
      return {
        title: "Design variant approved",
        badge: "Variant",
        iconType: "tick",
      };
    case "UIVariant.delete":
      return {
        title: "Design variant removed",
        badge: "Variant",
        iconType: "alert",
      };

    // Test Sessions
    case "TestSession.create":
      return {
        title: "Test session created",
        subtitle: nameOrTitle ? `"${nameOrTitle}"` : undefined,
        badge: "Session",
        iconType: "tick",
      };
    case "TestSession.update":
      return {
        title: "Test session updated",
        badge: "Session",
        iconType: "tick",
      };
    case "TestSession.activate":
      return {
        title: "Test session activated",
        badge: "Session",
        iconType: "tick",
      };
    case "TestSession.end":
      return {
        title: "Test session completed",
        badge: "Session",
        iconType: "tick",
      };
    case "TestSession.cancel":
      return {
        title: "Test session cancelled",
        badge: "Session",
        iconType: "alert",
      };
    case "TestSession.add_task":
      return {
        title: "Task added to test session",
        badge: "Session",
        iconType: "tick",
      };
    case "TestSession.update_task":
      return {
        title: "Task updated in test session",
        badge: "Session",
        iconType: "tick",
      };
    case "TestSession.remove_task":
      return {
        title: "Task removed from test session",
        badge: "Session",
        iconType: "alert",
      };
    case "TestSession.invite":
      return {
        title: "Tester invited",
        badge: "Testers",
        iconType: "tick",
      };
    case "TestSession.reissue_invitation":
      return {
        title: "Tester invitation resent",
        badge: "Testers",
        iconType: "tick",
      };
    case "TestSession.revoke":
      return {
        title: "Tester invitation revoked",
        badge: "Testers",
        iconType: "alert",
      };

    // Feedback Themes & Analysis
    case "FeedbackTheme.create":
      return {
        title: "Feedback theme discovered",
        subtitle: nameOrTitle ? `"${nameOrTitle}"` : undefined,
        badge: "Feedback",
        iconType: "alert",
      };
    case "FeedbackTheme.merge":
      return {
        title: "Feedback themes merged",
        badge: "Feedback",
        iconType: "tick",
      };
    case "FeedbackTheme.split":
      return {
        title: "Feedback theme split",
        badge: "Feedback",
        iconType: "tick",
      };
    case "FeedbackTheme.select":
      return {
        title: "Feedback theme prioritized",
        badge: "Feedback",
        iconType: "tick",
      };
    case "FeedbackTheme.deselect":
      return {
        title: "Feedback theme deprioritized",
        badge: "Feedback",
        iconType: "tick",
      };
    case "FeedbackTheme.wont_fix":
      return {
        title: "Feedback theme marked won't fix",
        badge: "Feedback",
        iconType: "alert",
      };

    case "FeedbackAnalysis.create":
      return {
        title: "Feedback analysis started",
        badge: "Feedback",
        iconType: "ai",
      };
    case "FeedbackAnalysis.approve":
      return {
        title: "Feedback analysis approved",
        badge: "Feedback",
        iconType: "tick",
      };
    case "FeedbackAnalysis.reject":
      return {
        title: "Feedback analysis rejected",
        badge: "Feedback",
        iconType: "alert",
      };
    case "FeedbackAnalysis.cancel":
      return {
        title: "Feedback analysis cancelled",
        badge: "Feedback",
        iconType: "alert",
      };

    // Stakeholder Collaboration & Reports
    case "SharedRound.acknowledge":
      return {
        title: "Stakeholder acknowledged round",
        badge: "Review",
        iconType: "view",
      };
    case "SharedRound.comment":
      return {
        title: "Stakeholder commented on round",
        badge: "Review",
        iconType: "view",
      };

    case "Report.create":
      return {
        title: "Stakeholder report generated",
        subtitle: (body.audience as string) ? `${body.audience} report` : undefined,
        badge: "Report",
        iconType: "tick",
      };

    // Workspace
    case "Workspace.create":
      return {
        title: "Workspace created",
        subtitle: nameOrTitle ? `"${nameOrTitle}"` : undefined,
        badge: "Workspace",
        iconType: "tick",
      };
    case "Workspace.update":
      return {
        title: "Workspace updated",
        badge: "Workspace",
        iconType: "tick",
      };

    // Generic Fallback
    default: {
      const parts = log.action.split(".");
      if (parts.length === 2) {
        const [entity, verb] = parts;
        const verbMap: Record<string, string> = {
          create: "created",
          update: "updated",
          delete: "deleted",
          activate: "activated",
          cancel: "cancelled",
          approve: "approved",
          invite: "invited",
          merge: "merged",
          split: "split",
        };
        const pastVerb = verbMap[verb] || verb;
        const humanEntity = entity.replace(/([A-Z])/g, " $1").trim();
        return {
          title: `${humanEntity} ${pastVerb}`,
          subtitle: nameOrTitle ? `"${nameOrTitle}"` : undefined,
          badge: humanEntity,
          iconType: verb === "delete" || verb === "cancel" ? "alert" : "tick",
        };
      }
      return {
        title: log.action,
        badge: log.entityType || "Activity",
        iconType: "generic",
      };
    }
  }
}
