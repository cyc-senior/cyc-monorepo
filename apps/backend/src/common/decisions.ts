import { DecisionType, Prisma } from '../generated/prisma/client'

export interface DecisionInput {
  projectId: string
  roundId: string
  type: DecisionType
  decidedById: string
  rationale?: string | null
  variantId?: string | null
  sessionId?: string | null
  analysisId?: string | null
  themeId?: string | null
  resultingRoundId?: string | null
}

/**
 * Appends a designer decision to the project's decision history. Always call it
 * inside the transaction of the change it describes, so the history can never
 * disagree with the state.
 */
export async function recordDecision(
  tx: Prisma.TransactionClient,
  decision: DecisionInput,
): Promise<void> {
  await tx.designDecision.create({
    data: {
      projectId: decision.projectId,
      roundId: decision.roundId,
      type: decision.type,
      decidedById: decision.decidedById,
      rationale: decision.rationale ?? null,
      variantId: decision.variantId ?? null,
      sessionId: decision.sessionId ?? null,
      analysisId: decision.analysisId ?? null,
      themeId: decision.themeId ?? null,
      resultingRoundId: decision.resultingRoundId ?? null,
    },
  })
}
