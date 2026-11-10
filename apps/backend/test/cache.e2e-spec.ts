import { INestApplication } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { GenerationModule } from './../src/modules/generation/generation.module'
import { PrismaService } from './../src/prisma/prisma.service'
import { FakeGenerationModule } from './fake-generation.module'

const PROJECT = '6b1c3f0e-2a43-4a6e-9a43-0c1c4f1d9a11'
const ALICE = '1f0e5d3c-9a43-4a6e-8b1c-6b1c3f0e2a43'
const BOB = '2a43e5d3-1f0e-4a6e-8b1c-6b1c3f0e9a43'

describe('Response cache (e2e)', () => {
  const prisma = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    projectMember: { findUnique: jest.fn() },
    project: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
    auditLog: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  }
  let app: INestApplication
  const tokens: Record<string, string> = {}

  beforeAll(async () => {
    // Caching is off for the other suites; this one is about it.
    process.env.CACHE_TTL_SECONDS = '60'
    const { AppModule } = await import('./../src/app.module')
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(GenerationModule)
      .useModule(FakeGenerationModule)
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile()

    app = moduleFixture.createNestApplication()
    await app.init()
    const jwt = app.get(JwtService)
    for (const [name, sub] of Object.entries({ ALICE, BOB })) {
      tokens[name] = await jwt.signAsync({ sub, email: `${name}@example.com` })
    }
  })

  afterAll(async () => {
    await app.close()
  })

  let name = 'Original'
  beforeEach(() => {
    jest.clearAllMocks()
    name = `Project ${Math.random()}`
    asRole('PRODUCT_OWNER')
    prisma.project.findUniqueOrThrow.mockImplementation(async () => ({
      id: PROJECT,
      name,
    }))
  })

  function asRole(role: string) {
    prisma.projectMember.findUnique.mockResolvedValue({ role })
  }
  const get = (user: string, path = `/projects/${PROJECT}`) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${tokens[user]}`)

  it('serves a repeated read from the cache', async () => {
    const first = await get('ALICE').expect(200)
    const second = await get('ALICE').expect(200)

    expect(first.headers['x-cache']).toBe('MISS')
    expect(second.headers['x-cache']).toBe('HIT')
    expect(second.body).toEqual(first.body)
    expect(prisma.project.findUniqueOrThrow).toHaveBeenCalledTimes(1)
  })

  it('still checks access on every request, cached or not', async () => {
    await get('ALICE').expect(200)
    prisma.projectMember.findUnique.mockResolvedValue(null)

    await get('ALICE').expect(404)
  })

  it('never shares a cached response between callers or roles', async () => {
    await get('ALICE').expect(200)

    expect((await get('BOB').expect(200)).headers['x-cache']).toBe('MISS')
    asRole('DESIGNER')
    expect((await get('ALICE').expect(200)).headers['x-cache']).toBe('MISS')
  })

  it('drops cached reads of a project once it changes', async () => {
    await get('ALICE').expect(200)
    asRole('DESIGNER')
    prisma.project.update.mockResolvedValue({ id: PROJECT })

    await request(app.getHttpServer())
      .patch(`/projects/${PROJECT}`)
      .set('Authorization', `Bearer ${tokens.BOB}`)
      .send({ name: 'Renamed' })
      .expect(200)
    asRole('PRODUCT_OWNER')
    name = 'Renamed'
    const after = await get('ALICE').expect(200)

    expect(after.headers['x-cache']).toBe('MISS')
    expect(after.body.name).toBe('Renamed')
  })

  it('never caches the audit log', async () => {
    asRole('DESIGNER')
    prisma.auditLog.findMany.mockResolvedValue([])
    prisma.auditLog.count.mockResolvedValue(0)
    const path = `/projects/${PROJECT}/audit-logs`

    await get('ALICE', path).expect(200)
    const second = await get('ALICE', path).expect(200)

    expect(second.headers['x-cache']).toBeUndefined()
    expect(prisma.auditLog.findMany).toHaveBeenCalledTimes(2)
  })

  it('tags every response with a request id, honouring a sane incoming one', async () => {
    const generated = await request(app.getHttpServer()).get('/health')
    const echoed = await request(app.getHttpServer())
      .get('/health')
      .set('X-Request-Id', 'trace-123')
    const unsafe = await request(app.getHttpServer())
      .get('/health')
      .set('X-Request-Id', 'bad id; with spaces')

    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
    expect(echoed.headers['x-request-id']).toBe('trace-123')
    expect(unsafe.headers['x-request-id']).not.toContain('bad id')
  })
})
