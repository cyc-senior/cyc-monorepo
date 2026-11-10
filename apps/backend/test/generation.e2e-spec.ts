import { INestApplication } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { AppModule } from './../src/app.module'
import { Prisma } from './../src/generated/prisma/client'
import { toDesignDocument } from './../src/modules/design/document/design-document'
import { UI_KITS } from './../src/modules/design/document/ui-kits'
import { GenerationModule } from './../src/modules/generation/generation.module'
import { PrismaService } from './../src/prisma/prisma.service'
import { fakeGeneration, FakeGenerationModule } from './fake-generation.module'

const PROJECT = '6b1c3f0e-2a43-4a6e-9a43-0c1c4f1d9a11'
const ROUND = '2a43e5d3-1f0e-4a6e-8b1c-6b1c3f0e9a43'
const JOB = '9a436b1c-3f0e-4a6e-8b1c-1f0e5d3c2a43'
const USER = '1f0e5d3c-9a43-4a6e-8b1c-6b1c3f0e2a43'

interface SseEvent {
  event?: string
  id?: string
  data?: Record<string, unknown>
}

function parseSse(body: string): SseEvent[] {
  return body
    .split('\n\n')
    .filter((block) => block.trim())
    .map((block) => {
      const event: SseEvent = {}
      for (const line of block.split('\n')) {
        const [field, ...rest] = line.split(': ')
        const value = rest.join(': ')
        if (field === 'event') {
          event.event = value
        }
        if (field === 'id') {
          event.id = value
        }
        if (field === 'data') {
          event.data = JSON.parse(value)
        }
      }

      return event
    })
}

describe('Design generation (e2e)', () => {
  const prisma = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    projectMember: { findUnique: jest.fn() },
    project: { findUniqueOrThrow: jest.fn() },
    designRound: { findFirstOrThrow: jest.fn() },
    userStory: { findMany: jest.fn() },
    generationJob: {
      create: jest.fn(),
      findFirstOrThrow: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    uIVariant: { create: jest.fn() },
    auditLog: { create: jest.fn() },
  }
  let app: INestApplication
  let token: string

  beforeAll(async () => {
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
    token = await app
      .get(JwtService)
      .signAsync({ sub: USER, email: 'designer@example.com' })
  })

  afterAll(async () => {
    await app.close()
  })

  const job = (overrides = {}) => ({
    id: JOB,
    roundId: ROUND,
    status: 'QUEUED',
    error: null,
    startedAt: null,
    finishedAt: null,
    variants: [],
    ...overrides,
  })

  beforeEach(() => {
    jest.resetAllMocks()
    fakeGeneration.llm.configured = true
    prisma.projectMember.findUnique.mockResolvedValue({ role: 'DESIGNER' })
    prisma.designRound.findFirstOrThrow.mockResolvedValue({
      id: ROUND,
      projectId: PROJECT,
      roundNumber: 1,
      status: 'DRAFT',
    })
    prisma.project.findUniqueOrThrow.mockResolvedValue({
      id: PROJECT,
      name: 'Checkout',
      description: null,
      designIntent: 'Pay in one tap on mobile',
      uiLibrary: 'MUI',
      targetPersona: { role: 'commuter' },
      designGuidelines: {},
      brandIdentity: {},
      toneOfVoice: {},
      designTokens: {},
      designVersion: 3,
    })
    prisma.generationJob.create.mockImplementation(async ({ data }) => ({
      ...job(),
      ...data,
    }))
    prisma.generationJob.findFirstOrThrow.mockResolvedValue(job())
  })

  const http = () => request(app.getHttpServer())
  const bearer = () => ({ Authorization: `Bearer ${token}` })
  const jobs = `/projects/${PROJECT}/rounds/${ROUND}/generation-jobs`

  describe('queueing', () => {
    it('snapshots the brief, uses the project UI kit and queues the job', async () => {
      const res = await http()
        .post(jobs)
        .set(bearer())
        .send({ prompt: 'Saved cards first', variantCount: 3 })
        .expect(202)

      expect(res.body).toMatchObject({
        status: 'QUEUED',
        uiLibrary: 'MUI',
        variantCount: 3,
        modelName: 'test-model',
      })
      const { data } = prisma.generationJob.create.mock.calls[0][0]
      expect(data.inputSnapshot).toMatchObject({
        design: { designIntent: 'Pay in one tap on mobile', uiLibrary: 'MUI' },
        prompt: 'Saved cards first',
        stories: [],
      })
      expect(fakeGeneration.queue.enqueue).toHaveBeenCalledWith(JOB)
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'GenerationJob.create' }),
      })
    })

    it('lets only designers generate', async () => {
      prisma.projectMember.findUnique.mockResolvedValue({
        role: 'PRODUCT_OWNER',
      })

      await http().post(jobs).set(bearer()).send({}).expect(403)
      expect(fakeGeneration.queue.enqueue).not.toHaveBeenCalled()
    })

    it('limits the number of alternatives', async () => {
      await http()
        .post(jobs)
        .set(bearer())
        .send({ variantCount: 9 })
        .expect(400)
    })

    it('answers 503 when generation is not configured', async () => {
      fakeGeneration.llm.configured = false

      await http().post(jobs).set(bearer()).send({}).expect(503)
      expect(prisma.generationJob.create).not.toHaveBeenCalled()
    })

    it('marks the job failed when the queue is unreachable', async () => {
      fakeGeneration.queue.enqueue.mockRejectedValue(new Error('down'))

      await http().post(jobs).set(bearer()).send({}).expect(503)
      expect(prisma.generationJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      )
    })
  })

  describe('server-sent events', () => {
    const events = `/projects/${PROJECT}/generation-jobs/${JOB}/events`
    const collect = () =>
      http()
        .get(events)
        .set(bearer())
        .buffer(true)
        .parse((res, done) => {
          let body = ''
          res.on('data', (chunk: Buffer) => (body += chunk.toString()))
          res.on('end', () => done(null, body))
        })

    it('streams the state, progress, then the final event, and ends', async () => {
      prisma.generationJob.findUniqueOrThrow
        .mockResolvedValueOnce(job({ status: 'RUNNING' }))
        .mockResolvedValueOnce(
          job({
            status: 'SUCCEEDED',
            variants: [{ id: 'v-1' }, { id: 'v-2' }],
          }),
        )
      setTimeout(() => {
        fakeGeneration.signals.next({
          jobId: JOB,
          kind: 'progress',
          progress: { stage: 'generating', variant: 1, of: 2, attempt: 1 },
        })
        fakeGeneration.signals.next({ jobId: JOB, kind: 'changed' })
      }, 150)

      const res = await collect().expect(200)

      expect(res.headers['content-type']).toContain('text/event-stream')
      expect(res.headers['x-cache']).toBeUndefined()
      const stream = parseSse(res.body as string)
      expect(stream.map((e) => e.event)).toEqual([
        'status',
        'progress',
        'completed',
      ])
      expect(stream.map((e) => e.id)).toEqual(['1', '2', '3'])
      expect(stream[0].data).toMatchObject({ status: 'RUNNING' })
      expect(stream[1].data).toMatchObject({ stage: 'generating', of: 2 })
      expect(stream[2].data).toMatchObject({
        status: 'SUCCEEDED',
        variantIds: ['v-1', 'v-2'],
      })
    })

    it('ends at once for a job that already finished', async () => {
      prisma.generationJob.findUniqueOrThrow.mockResolvedValue(
        job({ status: 'FAILED', error: 'No design passed' }),
      )

      const res = await collect().expect(200)

      expect(parseSse(res.body as string)).toEqual([
        expect.objectContaining({
          event: 'failed',
          data: expect.objectContaining({ error: 'No design passed' }),
        }),
      ])
    })

    it('answers 404 (not a stream) for a job of another project', async () => {
      prisma.generationJob.findFirstOrThrow.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('No record', {
          code: 'P2025',
          clientVersion: 'test',
        }),
      )

      const res = await http().get(events).set(bearer()).expect(404)

      expect(res.headers['content-type']).toContain('application/json')
    })
  })

  describe('cancelling', () => {
    const cancel = `/projects/${PROJECT}/generation-jobs/${JOB}/cancel`

    it('cancels an active job and takes it off the queue', async () => {
      prisma.generationJob.updateMany.mockResolvedValue({ count: 1 })

      await http().post(cancel).set(bearer()).expect(200)

      expect(prisma.generationJob.updateMany).toHaveBeenCalledWith({
        where: { id: JOB, status: { in: ['QUEUED', 'RUNNING'] } },
        data: { status: 'CANCELLED', finishedAt: expect.any(Date) },
      })
      expect(fakeGeneration.queue.withdraw).toHaveBeenCalledWith(JOB)
    })

    it('refuses to cancel a finished job', async () => {
      prisma.generationJob.updateMany.mockResolvedValue({ count: 0 })

      await http().post(cancel).set(bearer()).expect(409)
    })
  })

  describe('hand-made variants', () => {
    const variants = `/projects/${PROJECT}/rounds/${ROUND}/variants`
    const design = (label: string | undefined) =>
      toDesignDocument(
        {
          name: 'Pay',
          lang: 'en',
          description: 'One tap',
          screens: [
            {
              id: 's',
              type: 'FRAME',
              name: 'Checkout – Pay',
              layoutMode: 'VERTICAL',
              fills: [{ type: 'SOLID', color: '#FFFFFF' }],
              children: [
                {
                  id: 'h',
                  type: 'TEXT',
                  name: 'Title',
                  characters: 'Pay',
                  style: { fontSize: 24, fontWeight: 700 },
                  a11y: { role: 'heading', headingLevel: 1 },
                },
                {
                  id: 'f',
                  type: 'INSTANCE',
                  name: 'Card number',
                  componentKey: 'TextField',
                  componentProperties: label ? { label } : {},
                },
              ],
            },
          ],
        },
        UI_KITS.MUI,
      )

    it('rejects a design that fails WCAG, listing the issues', async () => {
      const res = await http()
        .post(variants)
        .set(bearer())
        .send({ name: 'No label', design: design(undefined) })
        .expect(422)

      expect(res.body.issues).toEqual([
        expect.objectContaining({ rule: 'wcag', criterion: '3.3.2' }),
      ])
      expect(prisma.uIVariant.create).not.toHaveBeenCalled()
    })

    it('stores a passing design with its accessibility report', async () => {
      prisma.uIVariant.create.mockImplementation(async ({ data }) => ({
        id: 'v-1',
        ...data,
        stories: [],
      }))

      await http()
        .post(variants)
        .set(bearer())
        .send({ name: 'Labelled', design: design('Card number') })
        .expect(201)

      const { data } = prisma.uIVariant.create.mock.calls[0][0]
      expect(data.uiLibrary).toBe('MUI')
      expect(data.accessibility).toMatchObject({
        standard: 'WCAG 2.0',
        level: 'AA',
        passed: true,
      })
    })
  })

  it('describes each UI kit and the design document schema', async () => {
    const res = await http().get('/ui-kits/MUI').set(bearer()).expect(200)

    expect(res.body.name).toBe('Material UI')
    expect(Object.keys(res.body.components)).toContain('TextField')
    expect(res.body.documentSchema.type).toBe('object')
    await http().get('/ui-kits/BOOTSTRAP').set(bearer()).expect(400)
  })
})
