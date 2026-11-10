import { ProjectRole } from '../../generated/prisma/client'

/**
 * Everything a project member can be allowed to do. Permissions are granted to
 * project roles in {@link ROLE_PERMISSIONS}; controllers only ever ask for a
 * permission (`@Authorize(Permission.X)`), never for a role.
 */
export enum Permission {
  ProjectRead = 'project:read',
  /** Name, description and archiving. */
  ProjectUpdate = 'project:update',
  ProjectDelete = 'project:delete',

  MemberRead = 'member:read',
  MemberManage = 'member:manage',

  /** The design brief, user stories, rounds, generation jobs and variants. */
  DesignRead = 'design:read',
  /** Changing the brief, generating, and editing designs. */
  DesignWrite = 'design:write',
  /** Approving (freezing) a design round. */
  DesignApprove = 'design:approve',

  AuditRead = 'audit:read',
}

const READ: Permission[] = Object.values(Permission).filter((permission) =>
  permission.endsWith(':read'),
)

/** Most to least privileged; also the column order of the docs table. */
export const ROLES = [
  'DESIGNER',
  'PROJECT_MANAGER',
  'PRODUCT_OWNER',
] as const satisfies readonly ProjectRole[]

/**
 * Designers own the project and its design. Project managers and product
 * owners follow the work: they read everything and change nothing (their say
 * in design decisions is planned to carry a role-specific weight).
 */
export const ROLE_PERMISSIONS: Readonly<
  Record<ProjectRole, ReadonlySet<Permission>>
> = {
  DESIGNER: new Set(Object.values(Permission)),
  PROJECT_MANAGER: new Set(READ),
  PRODUCT_OWNER: new Set(READ),
}

/** Whether `role` holds `permission`. */
export function can(role: ProjectRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission)
}

/** Roles that hold `permission`, most privileged first (used for API docs). */
export function rolesWith(permission: Permission): ProjectRole[] {
  return ROLES.filter((role) => can(role, permission))
}
