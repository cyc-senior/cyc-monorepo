import { INestApplication } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Test } from '@nestjs/testing'
import cookieParser from 'cookie-parser'
import request from 'supertest'

import { AppModule } from './../src/app.module'
import { GenerationModule } from './../src/modules/generation/generation.module'
import { PrismaService } from './../src/prisma/prisma.service'
import { FakeGenerationModule } from './fake-generation.module'

describe('App (e2e)', () => {
  const user = {
    id: '6b1c3f0e-2a43-4a6e-9a43-0c1c4f1d9a11',
    email: 'a@example.com',
    emailVerified: true,
    name: 'Ada',
    image: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  }
  const prisma = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    user: { findUnique: jest.fn() },
    refreshToken: { findFirst: jest.fn(), updateMany: jest.fn() },
  }
  let app: INestApplication
  let jwtService: JwtService

  beforeEach(async () => {
    jest.clearAllMocks()
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(GenerationModule)
      .useModule(FakeGenerationModule)
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile()

    app = moduleFixture.createNestApplication()
    app.use(cookieParser())
    await app.init()
    jwtService = app.get(JwtService)
  })

  afterEach(async () => {
    await app.close()
  })

  it('GET /health is public', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect(({ body }: { body: { status: string } }) =>
        expect(body.status).toBe('ok'),
      )
  })

  describe('bearer authentication', () => {
    it('rejects requests without a token', () => {
      return request(app.getHttpServer()).get('/users/me').expect(401)
    })

    it('rejects a malformed token', () => {
      return request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', 'Bearer not-a-jwt')
        .expect(401)
    })

    it('rejects a token signed with another secret', async () => {
      const forged = await new JwtService({ secret: 'x'.repeat(40) }).signAsync(
        { sub: user.id, email: user.email },
      )

      await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${forged}`)
        .expect(401)
    })

    it('resolves the current user from a valid bearer token', async () => {
      prisma.user.findUnique.mockResolvedValue(user)
      const token = await jwtService.signAsync({
        sub: user.id,
        email: user.email,
      })

      await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({ id: user.id, email: user.email })
        })
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: user.id },
      })
    })
  })

  describe('google oauth', () => {
    it('GET /auth/google redirects to Google with a state cookie', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/google')
        .expect(302)

      const location = new URL(res.headers.location)
      expect(location.origin).toBe('https://accounts.google.com')
      expect(location.searchParams.get('client_id')).toBe('e2e-client-id')

      const state = location.searchParams.get('state')
      expect(state).toBeTruthy()
      expect(res.headers['set-cookie'][0]).toContain(`oauth_state=${state}`)
      expect(res.headers['set-cookie'][0]).toContain('HttpOnly')
    })

    it('rejects the callback when the state does not match the cookie', () => {
      return request(app.getHttpServer())
        .get('/auth/google/callback?code=abc&state=forged')
        .set('Cookie', 'oauth_state=other')
        .expect(401)
    })

    it('rejects the callback when the state cookie is missing', () => {
      return request(app.getHttpServer())
        .get('/auth/google/callback?code=abc&state=forged')
        .expect(401)
    })
  })

  describe('POST /auth/refresh', () => {
    it('validates the body', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({})
        .expect(400)
    })
  })

  describe('POST /auth/logout', () => {
    it('requires a bearer token', () => {
      return request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken: 'x' })
        .expect(401)
    })
  })
})
