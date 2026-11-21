import { Request } from 'express'

import { WorkspaceRole, ProjectRole } from '../../generated/prisma/client'
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface'

/** What the permission guard resolved for the current request. */
export interface AccessContext {
  projectId: string
  /** The project's workspace (read from the database, never from the client). */
  workspaceId: string
  role: ProjectRole
}

/** What the workspace guard resolved for the current request. */
export interface WorkspaceAccessContext {
  workspaceId: string
  role: WorkspaceRole
}

export interface AccessRequest extends Request {
  user: AuthenticatedUser
  access?: AccessContext
  workspaceAccess?: WorkspaceAccessContext
}
