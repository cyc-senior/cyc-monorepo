import { ProjectRole } from '../../generated/prisma/client'

/**
 * Everything a project member can be allowed to do. Permissions are granted to
 * project roles in {@link ROLE_PERMISSIONS}; controllers only ever ask for a
 * permission (`@Authorize(Permission.X)`), never for a role.
 *
 * The role × permission matrix follows the project proposal; see
 * `docs/authorization.md`.
 */
export enum Permission {
  ProjectRead = 'project:read',
  /** Name, description and archiving. */
  ProjectUpdate = 'project:update',
  ProjectDelete = 'project:delete',

  MemberRead = 'member:read',
  MemberManage = 'member:manage',

  /** The design brief, user stories, rounds (all states), generation jobs and variants. */
  DesignRead = 'design:read',
  /** Changing the brief, generating, refining and editing designs. */
  DesignWrite = 'design:write',
  /** Approving a variant or a design round. */
  DesignApprove = 'design:approve',

  /** Test sessions, tasks, participants and their progress. */
  TestingRead = 'testing:read',
  /** Creating and running sessions, assigning testers, ending a session. */
  TestingManage = 'testing:manage',
  /** Raw participant feedback and interaction events. */
  FeedbackRead = 'feedback:read',

  /** AI feedback analyses and their themes. */
  AnalysisRead = 'analysis:read',
  /** Running an analysis; reviewing, editing, splitting, merging, deciding. */
  AnalysisWrite = 'analysis:write',
  /** Selecting feedback for the next iteration and starting it. */
  IterationManage = 'iteration:manage',

  /** Approved (shared) rounds and their approved designs. */
  SharedRoundRead = 'shared-round:read',
  /** Acknowledging and commenting on a shared round. */
  SharedRoundRespond = 'shared-round:respond',
  /** The development handoff of approved rounds. */
  HandoffRead = 'handoff:read',
  /** Project status, round progress and timeline gaps. */
  StatusRead = 'status:read',

  /** Reading the stakeholder reports written for the caller's role. */
  ReportRead = 'report:read',
  ReportGenerate = 'report:generate',

  AuditRead = 'audit:read',
}

/** Most to least privileged; also the column order of the docs table. */
export const ROLES = [
  'DESIGNER',
  'PROJECT_MANAGER',
  'PRODUCT_OWNER',
  'CLIENT',
  'DEVELOPER',
] as const satisfies readonly ProjectRole[]

/** What every member may do: see the project, its brief and team, shared rounds, reports. */
const MEMBER_BASE: Permission[] = [
  Permission.ProjectRead,
  Permission.MemberRead,
  Permission.SharedRoundRead,
  Permission.ReportRead,
]

/** Project manager: follows progress; changes nothing. */
const MANAGER: ReadonlySet<Permission> = new Set([
  ...MEMBER_BASE,
  Permission.StatusRead,
])

/**
 * - DESIGNER owns the project and the whole design loop, but is not a
 *   stakeholder: it neither comments on shared rounds nor reads the developer
 *   handoff (proposal matrix).
 * - PROJECT_MANAGER / PRODUCT_OWNER: approved rounds, project status, reports.
 *   No drafts, no raw feedback, no participants. (Same set today; they are
 *   separate roles so they can diverge.)
 * - CLIENT: approved rounds, acknowledge + comment, reports.
 * - DEVELOPER: approved rounds, development handoff, reports.
 *
 * Testers are not here: they are session participants, not project members.
 */
export const ROLE_PERMISSIONS: Readonly<
  Record<ProjectRole, ReadonlySet<Permission>>
> = {
  DESIGNER: new Set(
    Object.values(Permission).filter(
      (permission) =>
        permission !== Permission.SharedRoundRespond &&
        permission !== Permission.HandoffRead,
    ),
  ),
  PROJECT_MANAGER: MANAGER,
  PRODUCT_OWNER: MANAGER,
  CLIENT: new Set([...MEMBER_BASE, Permission.SharedRoundRespond]),
  DEVELOPER: new Set([...MEMBER_BASE, Permission.HandoffRead]),
}

/** Whether `role` holds `permission`. */
export function can(role: ProjectRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission)
}

/** Roles that hold `permission`, most privileged first (used for API docs). */
export function rolesWith(permission: Permission): ProjectRole[] {
  return ROLES.filter((role) => can(role, permission))
}
