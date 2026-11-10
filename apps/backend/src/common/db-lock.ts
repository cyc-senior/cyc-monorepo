import { Prisma } from '../generated/prisma/client'

/**
 * Takes a transaction-scoped advisory lock on `key`, serializing concurrent
 * transactions that need a read-then-write invariant (next sequence number,
 * "at least one owner", ...). Released automatically on commit/rollback.
 */
export async function lockKey(
  tx: Prisma.TransactionClient,
  key: string,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`
}
