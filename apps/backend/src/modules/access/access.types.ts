import { Request } from 'express'

import { OrganizationRole, ProjectRole } from '../../generated/prisma/client'
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface'

/** What the permission guard resolved for the current request. */
export interface AccessContext {
  projectId: string
  /** The project's organization (read from the database, never from the client). */
  organizationId: string
  role: ProjectRole
}

/** What the organization guard resolved for the current request. */
export interface OrgAccessContext {
  organizationId: string
  role: OrganizationRole
}

export interface AccessRequest extends Request {
  user: AuthenticatedUser
  access?: AccessContext
  orgAccess?: OrgAccessContext
}
