import { CallHandler, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { lastValueFrom, of } from 'rxjs'

import { AccessContext } from '../access/access.types'
import { AuditInterceptor } from './audit.interceptor'
import { AuditService } from './audit.service'

const PROJECT = '6b1c3f0e-2a43-4a6e-9a43-0c1c4f1d9a11'
const ROUND = '1f0e5d3c-9a43-4a6e-8b1c-6b1c3f0e2a43'

describe('AuditInterceptor', () => {
  const reflector = { getAllAndOverride: jest.fn(), get: jest.fn() }
  const audit = { record: jest.fn() }
  const interceptor = new AuditInterceptor(
    reflector as unknown as Reflector,
    audit as unknown as AuditService,
  )

  const access: AccessContext = { projectId: PROJECT, role: 'DESIGNER' }

  /** `result` is what the handler returns; omitted means a created entity. */
  async function run(request: Record<string, unknown>, ...rest: unknown[]) {
    const result = rest.length > 0 ? rest[0] : { id: ROUND }
    const context = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext
    const next: CallHandler = { handle: () => of(result) }

    return lastValueFrom(interceptor.intercept(context, next))
  }

  const request = (overrides: Record<string, unknown> = {}) => ({
    method: 'POST',
    params: { projectId: PROJECT },
    body: { title: 'x' },
    user: { id: 'u1' },
    access,
    ...overrides,
  })

  beforeEach(() => {
    jest.resetAllMocks()
    reflector.getAllAndOverride.mockReturnValue('DesignRound')
  })

  it('records who did what to which entity', async () => {
    await run(request())

    expect(audit.record).toHaveBeenCalledWith({
      projectId: PROJECT,
      actorId: 'u1',
      action: 'DesignRound.create',
      entityType: 'DesignRound',
      entityId: ROUND,
      changes: { body: { title: 'x' } },
    })
  })

  it('maps HTTP methods to verbs and honours @AuditAction', async () => {
    await run(request({ method: 'PATCH' }))
    reflector.get.mockReturnValue('approve')
    await run(request())

    expect(audit.record.mock.calls[0][0].action).toBe('DesignRound.update')
    expect(audit.record.mock.calls[1][0].action).toBe('DesignRound.approve')
  })

  it('takes the entity id from the route on deletes', async () => {
    await run(
      request({
        method: 'DELETE',
        params: { projectId: PROJECT, roundId: ROUND },
      }),
      undefined,
    )

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DesignRound.delete',
        entityId: ROUND,
        changes: {},
      }),
    )
  })

  it('does not audit reads, unmarked controllers or unscoped requests', async () => {
    await run(request({ method: 'GET' }))
    reflector.getAllAndOverride.mockReturnValue(undefined)
    await run(request())
    reflector.getAllAndOverride.mockReturnValue('DesignRound')
    await run(request({ access: undefined }))

    expect(audit.record).not.toHaveBeenCalled()
  })

  it('redacts secrets and summarises oversized bodies', async () => {
    await run(request({ body: { name: 'n', apiToken: 'abc', Password: 'p' } }))
    await run(request({ body: { blob: 'x'.repeat(20_000) } }))

    expect(audit.record.mock.calls[0][0].changes).toEqual({
      body: { name: 'n', apiToken: '[redacted]', Password: '[redacted]' },
    })
    expect(audit.record.mock.calls[1][0].changes).toEqual({
      body: { truncated: true, fields: ['blob'] },
    })
  })

  describe('projects', () => {
    beforeEach(() => reflector.getAllAndOverride.mockReturnValue('Project'))

    it('records the creation of a project under the new project', async () => {
      await run(request({ params: {}, access: undefined }), { id: PROJECT })

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: PROJECT,
          entityId: PROJECT,
          action: 'Project.create',
        }),
      )
    })

    it('skips deleting a project, whose audit log goes with it', async () => {
      await run(request({ method: 'DELETE' }), undefined)

      expect(audit.record).not.toHaveBeenCalled()
    })
  })
})
