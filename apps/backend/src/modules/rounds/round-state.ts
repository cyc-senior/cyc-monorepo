import { ConflictException } from '@nestjs/common'

import { lockKey } from '../../common/db-lock'
import { DesignRound, Prisma } from '../../generated/prisma/client'
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

/**
 * Creates the project's next round inside the caller's transaction. Round
 * numbers are sequential per project; the lock serializes concurrent creators.
 */
export async function createNextRound(
  tx: Prisma.TransactionClient,
  projectId: string,
  data: { title?: string | null; parentRoundId?: string | null },
): Promise<DesignRound> {
  await lockKey(tx, `project-rounds:${projectId}`)
  const last = await tx.designRound.aggregate({
    where: { projectId },
    _max: { roundNumber: true },
  })

  return tx.designRound.create({
    data: {
      projectId,
      title: data.title,
      parentRoundId: data.parentRoundId,
      roundNumber: (last._max.roundNumber ?? 0) + 1,
    },
  })
}
