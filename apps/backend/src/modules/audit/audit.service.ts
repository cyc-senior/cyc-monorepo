import { Injectable, Logger } from '@nestjs/common'

import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'

export interface AuditEntry {
  projectId: string
  actorId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  changes?: Prisma.InputJsonObject
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Appends an entry. Best effort: the audited change has already been
   * committed, so a logging failure is reported but never fails the request.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          projectId: entry.projectId,
          actorId: entry.actorId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          changes: entry.changes ?? {},
        },
      })
    } catch (error) {
      this.logger.error(
        `Failed to write audit entry ${entry.action}`,
        error instanceof Error ? error.stack : String(error),
      )
    }
  }

  list(where: Prisma.AuditLogWhereInput, page: { skip: number; take: number }) {
    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...page,
    })
  }

  count(where: Prisma.AuditLogWhereInput) {
    return this.prisma.auditLog.count({ where })
  }
}
