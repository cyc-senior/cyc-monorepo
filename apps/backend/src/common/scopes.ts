import { Prisma } from '../generated/prisma/client'

/**
 * Prisma `where` fragments that pin a row to a project through its parents.
 * Every project-scoped lookup goes through one of these so an id belonging to
 * another project is indistinguishable from a missing one.
 */
export const inProject = {
  round: (projectId: string): Prisma.DesignRoundWhereInput => ({ projectId }),
  job: (projectId: string): Prisma.GenerationJobWhereInput => ({
    round: { projectId },
  }),
  variant: (projectId: string): Prisma.UIVariantWhereInput => ({
    round: { projectId },
  }),
}
