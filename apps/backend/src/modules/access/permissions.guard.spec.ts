import {
  ExecutionContext,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { AccessService } from './access.service'
import { AccessRequest } from './access.types'
import { Permission } from './permissions'
import { PermissionsGuard } from './permissions.guard'

const UUID = '6b1c3f0e-2a43-4a6e-9a43-0c1c4f1d9a11'

describe('PermissionsGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() }
  const access = { forProject: jest.fn() }
  const guard = new PermissionsGuard(
    reflector as unknown as Reflector,
    access as unknown as AccessService,
  )

  const run = (request: Partial<AccessRequest>) =>
    guard.canActivate({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext)

  const request = (params: Record<string, string>): Partial<AccessRequest> => ({
    user: { id: 'u1', email: 'a@example.com' },
    params,
    method: 'GET',
  })

  beforeEach(() => {
    jest.resetAllMocks()
    reflector.getAllAndOverride.mockReturnValue(Permission.DesignWrite)
  })

  it('ignores routes without a required permission', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined)

    await expect(run(request({}))).resolves.toBe(true)
    expect(access.forProject).not.toHaveBeenCalled()
  })

  it('rejects an unauthenticated request', async () => {
    await expect(run({ params: { projectId: UUID } })).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
  })

  it('answers 404 when the user is not a member of the project', async () => {
    access.forProject.mockResolvedValue(null)

    await expect(run(request({ projectId: UUID }))).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })

  it('answers 404 without querying for a malformed project id', async () => {
    await expect(run(request({ projectId: 'nope' }))).rejects.toBeInstanceOf(
      NotFoundException,
    )
    expect(access.forProject).not.toHaveBeenCalled()
  })

  it('answers 403 when the role lacks the permission', async () => {
    access.forProject.mockResolvedValue({
      projectId: UUID,
      role: 'PRODUCT_OWNER',
    })

    await expect(run(request({ projectId: UUID }))).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })

  it('attaches the access context when the role holds the permission', async () => {
    const context = { projectId: UUID, role: 'DESIGNER' }
    access.forProject.mockResolvedValue(context)
    const req = request({ projectId: UUID })

    await expect(run(req)).resolves.toBe(true)
    expect(req.access).toEqual(context)
    expect(access.forProject).toHaveBeenCalledWith('u1', UUID)
  })

  it('fails closed on a guarded route that has no scope param', async () => {
    await expect(run(request({}))).rejects.toBeInstanceOf(
      InternalServerErrorException,
    )
  })
})
