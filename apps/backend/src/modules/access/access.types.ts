import { Request } from 'express'

import { ProjectRole } from '../../generated/prisma/client'
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface'

/** What the permission guard resolved for the current request. */
export interface AccessContext {
  projectId: string
  role: ProjectRole
}

export interface AccessRequest extends Request {
  user: AuthenticatedUser
  access?: AccessContext
}
