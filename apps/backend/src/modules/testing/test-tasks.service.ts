import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common'

import { lockKey } from '../../common/db-lock'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import {
  CreateTestTaskDto,
  TestTaskDto,
  UpdateTestTaskDto,
} from './dto/test-session.dto'
import { MAX_TASKS_PER_SESSION } from './testing.constants'

/**
 * Tasks a participant is asked to do. They define what is being measured, so
 * they are only editable while the session is a draft.
 */
@Injectable()
export class TestTasksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(projectId: string, sessionId: string): Promise<TestTaskDto[]> {
    await this.session(projectId, sessionId)

    return this.prisma.testTask.findMany({
      where: { sessionId },
      orderBy: { position: 'asc' },
    })
  }

  async create(
    projectId: string,
    sessionId: string,
    dto: CreateTestTaskDto,
  ): Promise<TestTaskDto> {
    await this.draftSession(projectId, sessionId)

    return this.prisma.$transaction(async (tx) => {
      await lockKey(tx, `session-tasks:${sessionId}`)
      const count = await tx.testTask.count({ where: { sessionId } })
      if (count >= MAX_TASKS_PER_SESSION) {
        throw new ConflictException(
          `A session can have at most ${MAX_TASKS_PER_SESSION} tasks.`,
        )
      }

      return tx.testTask.create({
        data: { ...dto, sessionId, position: count + 1 },
      })
    })
  }

  async update(
    projectId: string,
    sessionId: string,
    id: string,
    dto: UpdateTestTaskDto,
  ): Promise<TestTaskDto> {
    await this.draftSession(projectId, sessionId)
    const { position, ...fields } = dto

    await this.prisma.$transaction(async (tx) => {
      await lockKey(tx, `session-tasks:${sessionId}`)
      await this.findIn(tx, sessionId, id)
      await tx.testTask.update({ where: { id }, data: fields })
      if (position !== undefined) {
        await this.move(tx, sessionId, id, position)
      }
    })

    return this.prisma.testTask.findUniqueOrThrow({ where: { id } })
  }

  async remove(
    projectId: string,
    sessionId: string,
    id: string,
  ): Promise<void> {
    await this.draftSession(projectId, sessionId)

    await this.prisma.$transaction(async (tx) => {
      await lockKey(tx, `session-tasks:${sessionId}`)
      await this.findIn(tx, sessionId, id)
      await tx.testTask.delete({ where: { id } })
      await this.compact(tx, sessionId)
    })
  }

  private async move(
    tx: Prisma.TransactionClient,
    sessionId: string,
    id: string,
    position: number,
  ): Promise<void> {
    const ordered = await tx.testTask.findMany({
      where: { sessionId },
      orderBy: { position: 'asc' },
      select: { id: true },
    })
    if (position > ordered.length) {
      throw new BadRequestException(
        `position must be between 1 and ${ordered.length}.`,
      )
    }
    const ids = ordered.map((task) => task.id).filter((taskId) => taskId !== id)
    ids.splice(position - 1, 0, id)
    await this.renumber(tx, ids)
  }

  private async compact(
    tx: Prisma.TransactionClient,
    sessionId: string,
  ): Promise<void> {
    const ordered = await tx.testTask.findMany({
      where: { sessionId },
      orderBy: { position: 'asc' },
      select: { id: true },
    })
    await this.renumber(
      tx,
      ordered.map((task) => task.id),
    )
  }

  private async renumber(
    tx: Prisma.TransactionClient,
    ids: string[],
  ): Promise<void> {
    for (const [index, taskId] of ids.entries()) {
      await tx.testTask.update({
        where: { id: taskId },
        data: { position: index + 1 },
      })
    }
  }

  private async findIn(
    tx: Prisma.TransactionClient,
    sessionId: string,
    id: string,
  ) {
    return tx.testTask.findFirstOrThrow({ where: { id, sessionId } })
  }

  private session(projectId: string, sessionId: string) {
    return this.prisma.testSession.findFirstOrThrow({
      where: { id: sessionId, projectId },
      select: { id: true, status: true },
    })
  }

  private async draftSession(projectId: string, sessionId: string) {
    const session = await this.session(projectId, sessionId)
    if (session.status !== 'DRAFT') {
      throw new ConflictException(
        'Tasks can only be changed while the session is a draft.',
      )
    }

    return session
  }
}
