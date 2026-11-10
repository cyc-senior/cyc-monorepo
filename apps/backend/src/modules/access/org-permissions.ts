import { OrganizationRole } from '../../generated/prisma/client'

/**
 * What an organization member can be allowed to do. Organization membership is
 * the outer tenant boundary: it never grants access to a project by itself,
 * it only decides who may be invited to the organization's projects and who
 * may open new ones.
 */
export enum OrgPermission {
  OrgRead = 'org:read',
  OrgUpdate = 'org:update',
  OrgDelete = 'org:delete',
  OrgMemberRead = 'org-member:read',
  OrgMemberManage = 'org-member:manage',
  /** Opening a project in the organization. */
  OrgProjectCreate = 'org-project:create',
}

export const ORG_ROLES = [
  'ADMIN',
  'MEMBER',
] as const satisfies readonly OrganizationRole[]

const READ: OrgPermission[] = [
  OrgPermission.OrgRead,
  OrgPermission.OrgMemberRead,
]

export const ORG_ROLE_PERMISSIONS: Readonly<
  Record<OrganizationRole, ReadonlySet<OrgPermission>>
> = {
  /** Manages the organization and its members, and opens projects. */
  ADMIN: new Set(Object.values(OrgPermission)),
  /** Sees the organization and its people; works in the projects they are added to. */
  MEMBER: new Set(READ),
}

export function canInOrg(
  role: OrganizationRole,
  permission: OrgPermission,
): boolean {
  return ORG_ROLE_PERMISSIONS[role].has(permission)
}

export function orgRolesWith(permission: OrgPermission): OrganizationRole[] {
  return ORG_ROLES.filter((role) => canInOrg(role, permission))
}
