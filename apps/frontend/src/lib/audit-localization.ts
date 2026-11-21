import { AuditLogItem } from "@/lib/project-client";

export interface LocalizedAuditItem {
  title: string;
  subtitle?: string;
  badge: string;
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
      };
    case "Project.update":
      return {
        title: "Project settings updated",
        subtitle: nameOrTitle ? `"${nameOrTitle}"` : undefined,
        badge: "Project",
      };
    case "Project.delete":
      return {
        title: "Project deleted",
        badge: "Project",
      };

    // Project Members
    case "ProjectMember.create":
      return {
        title: "Team member invited",
        subtitle: (body.email as string) || undefined,
        badge: "Team",
      };
    case "ProjectMember.update":
      return {
        title: "Team member role changed",
        subtitle: (body.role as string) ? `Role: ${body.role}` : undefined,
        badge: "Team",
      };
    case "ProjectMember.delete":
      return {
        title: "Team member removed",
        badge: "Team",
      };

    // Design Intent
    case "DesignIntent.create":
    case "DesignIntent.update":
      return {
        title: "Design intent updated",
        subtitle: body.statement ? `"${body.statement}"` : undefined,
        badge: "Design intent",
      };

    // Personas
    case "UserPersona.create":
      return {
        title: "Persona created",
        subtitle: nameOrTitle ? `"${nameOrTitle}"` : undefined,
        badge: "Persona",
      };
    case "UserPersona.update":
      return {
        title: "Persona updated",
        subtitle: nameOrTitle ? `"${nameOrTitle}"` : undefined,
        badge: "Persona",
      };
    case "UserPersona.delete":
      return {
        title: "Persona deleted",
        badge: "Persona",
      };

    // User Stories
    case "UserStory.create":
      return {
        title: "User story created",
        subtitle: nameOrTitle ? `"${nameOrTitle}"` : undefined,
        badge: "User story",
      };
    case "UserStory.update":
      return {
        title: "User story updated",
        subtitle: nameOrTitle ? `"${nameOrTitle}"` : undefined,
        badge: "User story",
      };
    case "UserStory.delete":
      return {
        title: "User story removed",
        badge: "User story",
      };

    // Story Generations
    case "StoryGeneration.create":
      return {
        title: "AI story generation started",
        badge: "AI Generation",
      };
    case "StoryGeneration.cancel":
      return {
        title: "AI story generation cancelled",
        badge: "AI Generation",
      };

    // Design Rounds
    case "DesignRound.create":
      return {
        title: "Design round started",
        subtitle: nameOrTitle ? `"${nameOrTitle}"` : undefined,
        badge: "Round",
      };
    case "DesignRound.update":
      return {
        title: "Design round updated",
        badge: "Round",
      };
    case "DesignRound.approve":
      return {
        title: "Design round approved",
        badge: "Round",
      };
    case "DesignRound.iterate":
      return {
        title: "Design iteration started",
        badge: "Iteration",
      };

    // AI Generation Jobs
    case "GenerationJob.create":
      return {
        title: "AI design generation queued",
        badge: "AI Generation",
      };
    case "GenerationJob.cancel":
      return {
        title: "AI design generation cancelled",
        badge: "AI Generation",
      };

    // UI Variants
    case "UIVariant.create":
      return {
        title: "Design variant created",
        subtitle: nameOrTitle ? `"${nameOrTitle}"` : undefined,
        badge: "Variant",
      };
    case "UIVariant.update":
      return {
        title: "Design variant updated",
        badge: "Variant",
      };
    case "UIVariant.approve":
      return {
        title: "Design variant approved",
        badge: "Variant",
      };
    case "UIVariant.delete":
      return {
        title: "Design variant removed",
        badge: "Variant",
      };

    // Test Sessions
    case "TestSession.create":
      return {
        title: "Test session created",
        subtitle: nameOrTitle ? `"${nameOrTitle}"` : undefined,
        badge: "Test session",
      };
    case "TestSession.update":
      return {
        title: "Test session updated",
        badge: "Test session",
      };
    case "TestSession.activate":
      return {
        title: "Test session activated",
        badge: "Test session",
      };
    case "TestSession.end":
      return {
        title: "Test session completed",
        badge: "Test session",
      };
    case "TestSession.cancel":
      return {
        title: "Test session cancelled",
        badge: "Test session",
      };
    case "TestSession.add_task":
      return {
        title: "Task added to test session",
        badge: "Test session",
      };
    case "TestSession.update_task":
      return {
        title: "Task updated in test session",
        badge: "Test session",
      };
    case "TestSession.remove_task":
      return {
        title: "Task removed from test session",
        badge: "Test session",
      };
    case "TestSession.invite":
      return {
        title: "Tester invited",
        badge: "Testers",
      };
    case "TestSession.reissue_invitation":
      return {
        title: "Tester invitation resent",
        badge: "Testers",
      };
    case "TestSession.revoke":
      return {
        title: "Tester invitation revoked",
        badge: "Testers",
      };

    // Feedback Themes & Analysis
    case "FeedbackTheme.create":
      return {
        title: "Feedback theme discovered",
        subtitle: nameOrTitle ? `"${nameOrTitle}"` : undefined,
        badge: "Feedback",
      };
    case "FeedbackTheme.merge":
      return {
        title: "Feedback themes merged",
        badge: "Feedback",
      };
    case "FeedbackTheme.split":
      return {
        title: "Feedback theme split",
        badge: "Feedback",
      };
    case "FeedbackTheme.select":
      return {
        title: "Feedback theme prioritized",
        badge: "Feedback",
      };
    case "FeedbackTheme.deselect":
      return {
        title: "Feedback theme deprioritized",
        badge: "Feedback",
      };
    case "FeedbackTheme.wont_fix":
      return {
        title: "Feedback theme marked won't fix",
        badge: "Feedback",
      };

    case "FeedbackAnalysis.create":
      return {
        title: "Feedback analysis started",
        badge: "Feedback",
      };
    case "FeedbackAnalysis.approve":
      return {
        title: "Feedback analysis approved",
        badge: "Feedback",
      };
    case "FeedbackAnalysis.reject":
      return {
        title: "Feedback analysis rejected",
        badge: "Feedback",
      };
    case "FeedbackAnalysis.cancel":
      return {
        title: "Feedback analysis cancelled",
        badge: "Feedback",
      };

    // Stakeholder Collaboration & Reports
    case "SharedRound.acknowledge":
      return {
        title: "Stakeholder acknowledged round",
        badge: "Stakeholders",
      };
    case "SharedRound.comment":
      return {
        title: "Stakeholder commented on round",
        badge: "Stakeholders",
      };

    case "Report.create":
      return {
        title: "Stakeholder report generated",
        subtitle: (body.audience as string) ? `${body.audience} report` : undefined,
        badge: "Report",
      };

    // Workspace
    case "Workspace.create":
      return {
        title: "Workspace created",
        subtitle: nameOrTitle ? `"${nameOrTitle}"` : undefined,
        badge: "Workspace",
      };
    case "Workspace.update":
      return {
        title: "Workspace updated",
        badge: "Workspace",
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
        };
      }
      return {
        title: log.action,
        badge: log.entityType || "Activity",
      };
    }
  }
}
