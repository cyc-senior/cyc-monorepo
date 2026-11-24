import { BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Request, Response } from 'express'

import { EnvironmentVariables } from '../../config/env.validation'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'

describe('AuthController.refresh', () => {
  const tokens = {
    accessToken: 'access',
    refreshToken: 'new-refresh',
    tokenType: 'Bearer',
    expiresIn: 900,
  }

  function setup(nodeEnv: string) {
    const authService = { refresh: jest.fn().mockResolvedValue(tokens) }
    const config = {
      get: jest.fn((key: string) => (key === 'NODE_ENV' ? nodeEnv : undefined)),
    }
    const controller = new AuthController(
      authService as unknown as AuthService,
      config as unknown as ConfigService<EnvironmentVariables, true>,
    )
    const req = { cookies: {} } as unknown as Request
    const res = { cookie: jest.fn() }
    return { controller, authService, req, res }
  }

  it('moves a body token into the cookie outside production', async () => {
    const { controller, req, res } = setup('development')

    const body = await controller.refresh(req, res as unknown as Response, {
      refreshToken: 'old',
      cookie: true,
    })

    expect(res.cookie).toHaveBeenCalledWith(
      'refreshToken',
      'new-refresh',
      expect.objectContaining({ httpOnly: true }),
    )
    expect(body).not.toHaveProperty('refreshToken')
  })

  it('refuses `cookie: true` in production without spending the token', async () => {
    const { controller, authService, req, res } = setup('production')

    await expect(
      controller.refresh(req, res as unknown as Response, {
        refreshToken: 'old',
        cookie: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(authService.refresh).not.toHaveBeenCalled()
    expect(res.cookie).not.toHaveBeenCalled()
  })

  it('still returns body tokens in production', async () => {
    const { controller, req, res } = setup('production')

    await expect(
      controller.refresh(req, res as unknown as Response, {
        refreshToken: 'old',
      }),
    ).resolves.toEqual(tokens)
  })
})
