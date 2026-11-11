import { INestApplication } from '@nestjs/common'
import { PATH_METADATA } from '@nestjs/common/constants'
import { DiscoveryModule, DiscoveryService } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { AppModule } from './../src/app.module'
import { PERMISSION_KEY } from './../src/modules/access/access.constants'
import { IS_PUBLIC_KEY } from './../src/modules/auth/decorators/public.decorator'
import { PrismaService } from './../src/prisma/prisma.service'
import { GenerationModule } from './../src/modules/generation/generation.module'
import { buildOpenApiDocument } from './../src/swagger'
import { FakeGenerationModule } from './fake-generation.module'

const PROJECT = '6b1c3f0e-2a43-4a6e-9a43-0c1c4f1d9a11'
const USER = '1f0e5d3c-9a43-4a6e-8b1c-6b1c3f0e2a43'

describe('Authorization (e2e)', () => {
  const prisma = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    projectMember: { findUnique: jest.fn() },
    project: {
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    auditLog: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  }
  let app: INestApplication
  let token: string

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule, DiscoveryModule],
    })
      .overrideModule(GenerationModule)
      .useModule(FakeGenerationModule)
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile()

    app = moduleFixture.createNestApplication()
    await app.init()
    token = await app
      .get(JwtService)
      .signAsync({ sub: USER, email: 'a@example.com' })
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    jest.resetAllMocks()
    prisma.project.findUniqueOrThrow.mockResolvedValue({
      id: PROJECT,
      name: 'P',
    })
    prisma.project.update.mockResolvedValue({ id: PROJECT })
  })

  const asRole = (role: string | null) =>
    prisma.projectMember.findUnique.mockResolvedValue(role ? { role } : null)
  const bearer = () => ({ Authorization: `Bearer ${token}` })

  describe('route coverage', () => {
    interface Handler {
      route: string
      handler: object
      controller: object
    }

    function handlers(): Handler[] {
      const found: Handler[] = []
      for (const wrapper of app.get(DiscoveryService).getControllers()) {
        const { instance, metatype } = wrapper
        if (!instance || !metatype) {
          continue
        }
        const prototype = Object.getPrototypeOf(instance)
        const base = Reflect.getMetadata(PATH_METADATA, metatype) as string
        for (const name of Object.getOwnPropertyNames(prototype)) {
          if (name === 'constructor') {
            continue
          }
          const handler = prototype[name]
          const path =
            typeof handler === 'function'
              ? (Reflect.getMetadata(PATH_METADATA, handler) as string)
              : undefined
          if (path !== undefined) {
            found.push({
              route: `${metatype.name}.${name} (${base}/${path})`,
              handler,
              controller: metatype,
            })
          }
        }
      }

      return found
    }

    it('finds the application routes', () => {
      expect(handlers().length).toBeGreaterThan(30)
    })

    it('guards every project-scoped route with @Authorize', () => {
      const unguarded = handlers()
        .filter(({ route }) => /:projectId\b/.test(route))
        .filter(
          ({ handler, controller }) =>
            !Reflect.getMetadata(PERMISSION_KEY, handler) &&
            !Reflect.getMetadata(PERMISSION_KEY, controller),
        )
        .map(({ route }) => route)

      // Without @Authorize any signed-in user could reach another project's data.
      expect(unguarded).toEqual([])
    })

    it('marks every /public route @Public so it is reachable without a login', () => {
      const closed = handlers()
        .filter(({ route }) => /\(\/?public\//.test(route))
        .filter(
          ({ handler, controller }) =>
            !Reflect.getMetadata(IS_PUBLIC_KEY, handler) &&
            !Reflect.getMetadata(IS_PUBLIC_KEY, controller),
        )
        .map(({ route }) => route)

      expect(closed).toEqual([])
    })

    it('never exposes a route that is both public and permission-guarded', () => {
      const both = handlers()
        .filter(
          ({ handler, controller }) =>
            (Reflect.getMetadata(IS_PUBLIC_KEY, handler) ||
              Reflect.getMetadata(IS_PUBLIC_KEY, controller)) &&
            Reflect.getMetadata(PERMISSION_KEY, handler),
        )
        .map(({ route }) => route)

      expect(both).toEqual([])
    })
  })

  describe('project-scoped routes', () => {
    it('requires a bearer token', () =>
      request(app.getHttpServer()).get(`/projects/${PROJECT}`).expect(401))

    it('hides a project from non-members with a 404', async () => {
      asRole(null)

      await request(app.getHttpServer())
        .get(`/projects/${PROJECT}`)
        .set(bearer())
        .expect(404)
      expect(prisma.project.findUniqueOrThrow).not.toHaveBeenCalled()
    })

    it('answers a malformed id with 404 without a database lookup', async () => {
      await request(app.getHttpServer())
        .get('/projects/not-a-uuid')
        .set(bearer())
        .expect(404)
      expect(prisma.projectMember.findUnique).not.toHaveBeenCalled()
    })

    it.each(['PROJECT_MANAGER', 'PRODUCT_OWNER'])(
      'lets a %s read but not change a project or its design',
      async (role) => {
        asRole(role)

        await request(app.getHttpServer())
          .get(`/projects/${PROJECT}`)
          .set(bearer())
          .expect(200)
        await request(app.getHttpServer())
          .patch(`/projects/${PROJECT}/design`)
          .set(bearer())
          .send({ uiLibrary: 'MUI' })
          .expect(403)
        prisma.auditLog.findMany.mockResolvedValue([])
        prisma.auditLog.count.mockResolvedValue(0)
        await request(app.getHttpServer())
          .get(`/projects/${PROJECT}/audit-logs`)
          .set(bearer())
          .expect(200)
      },
    )

    it('lets a read-only member read but not rename a project', async () => {
      asRole('PRODUCT_OWNER')

      await request(app.getHttpServer())
        .get(`/projects/${PROJECT}`)
        .set(bearer())
        .expect(200)
      await request(app.getHttpServer())
        .patch(`/projects/${PROJECT}`)
        .set(bearer())
        .send({ name: 'renamed' })
        .expect(403)
      expect(prisma.project.update).not.toHaveBeenCalled()
    })

    it('lets a designer change the design brief', async () => {
      asRole('DESIGNER')

      await request(app.getHttpServer())
        .patch(`/projects/${PROJECT}/design`)
        .set(bearer())
        .send({ uiLibrary: 'MUI' })
        .expect(200)
      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: PROJECT },
        data: { uiLibrary: 'MUI', designVersion: { increment: 1 } },
      })
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'Project.update_design',
          projectId: PROJECT,
          actorId: USER,
        }),
      })
    })

    it('only accepts the supported UI libraries', async () => {
      asRole('DESIGNER')

      await request(app.getHttpServer())
        .patch(`/projects/${PROJECT}/design`)
        .set(bearer())
        .send({ uiLibrary: 'BOOTSTRAP' })
        .expect(400)
    })

    it('lets a designer delete a project', async () => {
      asRole('DESIGNER')
      prisma.project.delete.mockResolvedValue({})

      await request(app.getHttpServer())
        .delete(`/projects/${PROJECT}`)
        .set(bearer())
        .expect(204)
      expect(prisma.project.delete).toHaveBeenCalledWith({
        where: { id: PROJECT },
      })
    })

    it('lets any signed-in user create a project with its brief, as its designer', async () => {
      prisma.project.create.mockImplementation(async ({ data }) => ({
        id: PROJECT,
        ...data,
      }))

      const created = await request(app.getHttpServer())
        .post('/projects')
        .set(bearer())
        .send({
          name: 'Checkout',
          designIntent: 'Faster mobile checkout',
          uiLibrary: 'SHADCN',
        })
        .expect(201)

      expect(created.body.role).toBe('DESIGNER')
      expect(prisma.project.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          uiLibrary: 'SHADCN',
          createdById: USER,
          members: { create: { userId: USER, role: 'DESIGNER' } },
          rounds: { create: { roundNumber: 1 } },
        }),
      })
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'Project.create',
          projectId: PROJECT,
        }),
      })
    })

    it('requires the design intent and UI library to create a project', async () => {
      await request(app.getHttpServer())
        .post('/projects')
        .set(bearer())
        .send({ name: 'Checkout' })
        .expect(400)
      expect(prisma.project.create).not.toHaveBeenCalled()
    })

    it('does not audit a request that was refused', async () => {
      asRole('PROJECT_MANAGER')

      await request(app.getHttpServer())
        .delete(`/projects/${PROJECT}`)
        .set(bearer())
        .expect(403)
      expect(prisma.auditLog.create).not.toHaveBeenCalled()
    })

    it('validates the body of an allowed request', async () => {
      asRole('DESIGNER')

      await request(app.getHttpServer())
        .patch(`/projects/${PROJECT}`)
        .set(bearer())
        .send({ name: 'ok', role: 'DESIGNER' })
        .expect(400)
    })
  })

  describe('API documentation', () => {
    it('documents the access scheme of every operation', () => {
      const document = buildOpenApiDocument(app)
      const undocumented: string[] = []
      for (const [path, item] of Object.entries(document.paths)) {
        for (const [method, operation] of Object.entries(item)) {
          const op = operation as { security?: unknown[]; summary?: string }
          const isPublic = path.startsWith('/auth') || path === '/health'
          if (!op.summary && path !== '/users/me' && path !== '/health') {
            undocumented.push(`${method} ${path}: no summary`)
          }
          if (!isPublic && !op.security?.length) {
            undocumented.push(`${method} ${path}: no security scheme`)
          }
        }
      }

      expect(undocumented).toEqual([])
      expect(Object.keys(document.components.securitySchemes)).toEqual([
        'bearer',
      ])
    })

    it('lists the roles allowed on each guarded operation', () => {
      const document = buildOpenApiDocument(app)
      const patch = document.paths['/projects/{projectId}'].patch
      const forbidden = patch.responses['403'] as { description: string }

      expect(forbidden.description).toContain('project:update')
      expect(forbidden.description).toContain('(roles: DESIGNER)')
    })
  })
})
