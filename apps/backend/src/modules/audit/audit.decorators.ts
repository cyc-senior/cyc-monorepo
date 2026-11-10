import { SetMetadata } from '@nestjs/common'

export const AUDIT_ENTITY_KEY = 'auditEntity'
export const AUDIT_ACTION_KEY = 'auditAction'

/**
 * Class-level: records every successful POST/PUT/PATCH/DELETE handled by the
 * controller in the audit log, under this entity type.
 */
export const AuditEntity = (entityType: string) =>
  SetMetadata(AUDIT_ENTITY_KEY, entityType)

/**
 * Handler-level: overrides the verb in the action name (default `create`,
 * `update` or `delete` from the HTTP method), e.g. `approve`.
 */
export const AuditAction = (verb: string) => SetMetadata(AUDIT_ACTION_KEY, verb)
