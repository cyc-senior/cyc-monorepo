import { WorkspaceRole } from '../../generated/prisma/client'

/**
 * What a workspace member can be allowed to do. Workspace membership is
 * the outer tenant boundary: it never grants access to a project by itself,
 * it only decides who may be invited to the workspace's projects and who
 * may open new ones.
 */
export enum WorkspacePermission {
  WorkspaceRead = 'workspace:read',
  WorkspaceUpdate = 'workspace:update',
  WorkspaceDelete = 'workspace:delete',
  WorkspaceMemberRead = 'workspace-member:read',
  WorkspaceMemberManage = 'workspace-member:manage',
  /** Opening a project in the workspace. */
  WorkspaceProjectCreate = 'workspace-project:create',
}

export const WORKSPACE_ROLES = [
  'ADMIN',
  'MEMBER',
] as const satisfies readonly WorkspaceRole[]

const READ: WorkspacePermission[] = [
  WorkspacePermission.WorkspaceRead,
  WorkspacePermission.WorkspaceMemberRead,
]

export const WORKSPACE_ROLE_PERMISSIONS: Readonly<
  Record<WorkspaceRole, ReadonlySet<WorkspacePermission>>
> = {
  /** Manages the workspace and its members, and opens projects. */
  ADMIN: new Set(Object.values(WorkspacePermission)),
  /** Sees the workspace and its people; works in the projects they are added to. */
  MEMBER: new Set(READ),
}

export function canInWorkspace(
  role: WorkspaceRole,
  permission: WorkspacePermission,
): boolean {
  return WORKSPACE_ROLE_PERMISSIONS[role].has(permission)
}

export function workspaceRolesWith(
  permission: WorkspacePermission,
): WorkspaceRole[] {
  return WORKSPACE_ROLES.filter((role) => canInWorkspace(role, permission))
}
