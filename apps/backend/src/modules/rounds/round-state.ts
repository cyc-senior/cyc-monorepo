import { ConflictException } from '@nestjs/common'

import { DesignRound } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'

/**
 * Loads a round of the project and rejects it if it is approved or archived:
 * those rounds are frozen, so nothing new may be attached to them.
 *
 * @throws NotFound (via Prisma) when the round is not in the project.
 * @throws ConflictException when the round is APPROVED or ARCHIVED.
 */
export async function requireWritableRound(
  prisma: PrismaService,
  projectId: string,
  roundId: string,
): Promise<DesignRound> {
  const round = await prisma.designRound.findFirstOrThrow({
    where: { id: roundId, projectId },
  })
  if (round.status === 'APPROVED' || round.status === 'ARCHIVED') {
    throw new ConflictException(
      `Round ${round.roundNumber} is ${round.status.toLowerCase()} and can no longer be changed.`,
    )
  }

  return round
}
