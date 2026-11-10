import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { isUUID } from 'class-validator'
import { Observable, mergeMap } from 'rxjs'

import { logEvent } from '../../common/logging/log-event'
import { Prisma } from '../../generated/prisma/client'
import { AccessRequest } from '../access/access.types'
import { AUDIT_ACTION_KEY, AUDIT_ENTITY_KEY } from './audit.decorators'
import { AuditService } from './audit.service'

const VERBS: Record<string, string> = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
}

/** Request bodies larger than this are summarised to their keys. */
const MAX_BODY_CHARS = 10_000
const SENSITIVE_KEY = /token|secret|password/i

/**
 * Writes an audit entry after each successful mutation on a controller marked
 * with `@AuditEntity`, and logs it as a domain event (`Entity.verb`). Runs
 * after the permission guard, so the actor and the project come from the
 * resolved access context.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Domain')

  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const entityType = this.reflector.getAllAndOverride<string | undefined>(
      AUDIT_ENTITY_KEY,
      [context.getHandler(), context.getClass()],
    )
    const request = context.switchToHttp().getRequest<AccessRequest>()
    const verb = VERBS[request.method]
    if (!entityType || !verb) {
      return next.handle()
    }

    const action = this.reflector.get<string | undefined>(
      AUDIT_ACTION_KEY,
      context.getHandler(),
    )

    return next.handle().pipe(
      mergeMap(async (result: unknown) => {
        await this.write(request, entityType, action ?? verb, result)

        return result
      }),
    )
  }

  private async write(
    request: AccessRequest,
    entityType: string,
    verb: string,
    result: unknown,
  ): Promise<void> {
    const resultId = (result as { id?: unknown } | null)?.id
    const entityId =
      typeof resultId === 'string' ? resultId : this.lastUuidParam(request)
    // Creating a project happens outside any project; its creator is its designer.
    const creatingProject = entityType === 'Project' && verb === 'create'
    const projectId = creatingProject ? entityId : request.access?.projectId
    const role = creatingProject ? 'DESIGNER' : request.access?.role
    if (!projectId) {
      return
    }

    this.logger.log(
      logEvent(`${entityType}.${verb}`, {
        id: entityId,
        project: projectId,
        actor: request.user.id,
        role,
      }),
    )
    // Deleting a project cascades its audit log away; there is nothing left
    // to attach an entry to.
    if (entityType === 'Project' && verb === 'delete') {
      return
    }

    await this.audit.record({
      projectId,
      actorId: request.user.id,
      action: `${entityType}.${verb}`,
      entityType,
      entityId,
      changes: verb === 'delete' ? {} : { body: this.summarise(request.body) },
    })
  }

  private lastUuidParam(request: AccessRequest): string | null {
    const ids = Object.values(request.params).filter(
      (value): value is string => typeof value === 'string' && isUUID(value),
    )

    return ids.at(-1) ?? null
  }

  private summarise(body: unknown): Prisma.InputJsonValue {
    if (body === null || typeof body !== 'object') {
      return {}
    }

    const redacted = Object.fromEntries(
      Object.entries(body).map(([key, value]) => [
        key,
        SENSITIVE_KEY.test(key) ? '[redacted]' : value,
      ]),
    )
    if (JSON.stringify(redacted).length > MAX_BODY_CHARS) {
      return { truncated: true, fields: Object.keys(redacted) }
    }

    return redacted as Prisma.InputJsonValue
  }
}
