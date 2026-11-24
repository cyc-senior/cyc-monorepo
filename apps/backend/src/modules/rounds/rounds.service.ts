import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  MessageEvent,
  NotFoundException,
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { z } from 'zod'

import { recordDecision } from '../../common/decisions'
import { lockKey } from '../../common/db-lock'
import { Page, paginate } from '../../common/dto/pagination.dto'
import { llmJsonSchema } from '../../common/json-schema'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { LlmClient } from '../generation/llm.client'
import {
  CreateDesignRoundDto,
  DesignRoundDto,
  DesignRoundQueryDto,
  UpdateDesignRoundDto,
} from './dto/design-round.dto'
import { createNextRound } from './round-state'

const text = (max: number, description: string) =>
  z.string().trim().min(1).max(max).describe(description)

const variantSchema = (description: string) =>
  z
    .object({
      name: text(120, 'Short name of the variant'),
      description: text(2000, description),
    })
    .strict()

/** What the model must answer when drafting a structured prompt. */
const draftPromptSchema = z
  .object({
    goal: text(2000, 'A clear, concise user goal to achieve in the interface'),
    problem: text(2000, 'The core user problem or friction being addressed'),
    mustUse: text(
      2000,
      'Design system, accessibility standards, brand colors, and guidelines',
    ),
    comparisonQuestion: text(
      500,
      'The evaluation question testers answer when comparing Variant A vs Variant B',
    ),
    variantA: variantSchema(
      'One clear design thesis or UX strategy for Variant A',
    ),
    variantB: variantSchema(
      'A distinct, contrasting UX strategy for Variant B',
    ),
  })
  .strict()

export type DraftPromptResult = z.infer<typeof draftPromptSchema>

const DRAFT_PROMPT_JSON_SCHEMA = llmJsonSchema(draftPromptSchema)

/**
 * Validates the model's answer. Throws a message fit to show the designer
 * when it was cut off, is not JSON, or misses a field.
 */
export function parseDraftPrompt(
  content: string,
  finishReason: string | null,
): DraftPromptResult {
  if (finishReason === 'length') {
    throw new Error('The drafted prompt was cut off by the model. Try again.')
  }
  let json: unknown
  try {
    json = JSON.parse(content)
  } catch {
    throw new Error('The model did not return a valid prompt. Try again.')
  }
  const parsed = draftPromptSchema.safeParse(json)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new Error(
      `The drafted prompt was incomplete (${issue ? `${issue.path.join('.')}: ${issue.message}` : 'invalid'}). Try again.`,
    )
  }

  return parsed.data
}

@Injectable()
export class RoundsService {
  private readonly logger = new Logger(RoundsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmClient,
  ) {}

  list(
    projectId: string,
    query: DesignRoundQueryDto,
  ): Promise<Page<DesignRoundDto>> {
    const where: Prisma.DesignRoundWhereInput = {
      projectId,
      status: query.status,
    }

    return paginate(
      query,
      (page) =>
        this.prisma.designRound.findMany({
          where,
          orderBy: { roundNumber: 'desc' },
          ...page,
        }),
      () => this.prisma.designRound.count({ where }),
    )
  }

  /** Creates the next round; numbers are sequential per project. */
  async create(
    projectId: string,
    dto: CreateDesignRoundDto,
  ): Promise<DesignRoundDto> {
    if (dto.parentRoundId) {
      await this.get(projectId, dto.parentRoundId)
    }
    if (
      dto.storyId &&
      !(await this.prisma.userStory.findFirst({
        where: { id: dto.storyId, projectId },
        select: { id: true },
      }))
    ) {
      throw new BadRequestException(
        'storyId must be a user story of this project.',
      )
    }

    return this.prisma.$transaction((tx) =>
      createNextRound(tx, projectId, {
        title: dto.title,
        parentRoundId: dto.parentRoundId,
        storyId: dto.storyId ?? undefined,
      }),
    )
  }

  get(projectId: string, id: string): Promise<DesignRoundDto> {
    return this.prisma.designRound.findFirstOrThrow({
      where: { id, projectId },
    })
  }

  /**
   * Updates title, parent or status.
   *
   * @throws BadRequestException when asked to set APPROVED, or a parent that is
   *   not an earlier round of the project.
   * @throws ConflictException when the round is approved (frozen apart from
   *   archiving).
   */
  async update(
    projectId: string,
    id: string,
    dto: UpdateDesignRoundDto,
  ): Promise<DesignRoundDto> {
    const round = await this.get(projectId, id)

    if (dto.status === 'APPROVED') {
      throw new BadRequestException(
        'Use the approve endpoint to approve a round.',
      )
    }
    const approved = round.status === 'APPROVED' || round.approvedAt !== null
    if (approved && !this.isArchiveOnly(dto)) {
      throw new ConflictException(
        'An approved round is frozen; it can only be archived.',
      )
    }
    if (dto.parentRoundId) {
      const parent = await this.get(projectId, dto.parentRoundId)
      if (parent.roundNumber >= round.roundNumber) {
        throw new BadRequestException(
          'The parent must be an earlier round of the project.',
        )
      }
    }

    return this.prisma.designRound.update({ where: { id }, data: dto })
  }

  /**
   * Approves the round once; it is frozen afterwards and becomes visible to
   * stakeholders (client, developer, project manager). The approval is
   * recorded in the decision history in the same transaction.
   *
   * @throws ConflictException when already approved/archived, or while a test
   *   session of the round is still running.
   */
  async approve(
    projectId: string,
    id: string,
    userId: string,
  ): Promise<DesignRoundDto> {
    await this.get(projectId, id)

    await this.prisma.$transaction(async (tx) => {
      const running = await tx.testSession.count({
        where: { roundId: id, status: 'ACTIVE' },
      })
      if (running > 0) {
        throw new ConflictException(
          'End the round’s running test sessions before approving it.',
        )
      }
      // Conditional update: two concurrent approvals cannot both succeed.
      const claimed = await tx.designRound.updateMany({
        where: { id, projectId, status: { notIn: ['APPROVED', 'ARCHIVED'] } },
        data: {
          status: 'APPROVED',
          approvedById: userId,
          approvedAt: new Date(),
        },
      })
      if (claimed.count === 0) {
        throw new ConflictException(
          'The round is already approved or archived.',
        )
      }
      await recordDecision(tx, {
        projectId,
        roundId: id,
        type: 'ROUND_APPROVED',
        decidedById: userId,
      })
    })

    return this.get(projectId, id)
  }

  /**
   * Deletes the round with its jobs and variants.
   *
   * @throws ConflictException for an approved round, one with test sessions,
   *   or the project's last one.
   */
  async remove(projectId: string, id: string): Promise<void> {
    const round = await this.get(projectId, id)
    if (round.approvedAt) {
      throw new ConflictException('An approved round cannot be deleted.')
    }
    const sessions = await this.prisma.testSession.count({
      where: { roundId: id },
    })
    if (sessions > 0) {
      // Test results are research data; archive the round instead.
      throw new ConflictException(
        'A round with test sessions cannot be deleted; archive it instead.',
      )
    }

    await this.prisma.$transaction(async (tx) => {
      await lockKey(tx, `project-rounds:${projectId}`)
      if ((await tx.designRound.count({ where: { projectId } })) <= 1) {
        throw new ConflictException('A project must keep at least one round.')
      }
      await tx.designRound.delete({ where: { id } })
    })
  }

  private isArchiveOnly(dto: UpdateDesignRoundDto): boolean {
    const fields = Object.entries(dto).filter(
      ([, value]) => value !== undefined,
    )

    return fields.length === 1 && dto.status === 'ARCHIVED'
  }

  /**
   * Streams the structured prompt drafting via LLM.
   */
  streamDraftPrompt(
    projectId: string,
    storyId: string,
    personaId?: string,
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const abortController = new AbortController()

      ;(async () => {
        try {
          // Inputs are checked before any progress is reported: a story or
          // persona outside the project ends the stream with an `error`
          // event and nothing else. (The query DTO already rejects missing
          // or malformed ids with a 400 before the stream opens.)
          const [story, intent, persona] = await Promise.all([
            this.prisma.userStory.findFirst({
              where: { id: storyId, projectId },
            }),
            this.prisma.designIntent.findFirst({
              where: { projectId },
              orderBy: { version: 'desc' },
            }),
            personaId
              ? this.prisma.userPersona.findFirst({
                  where: { id: personaId, projectId },
                })
              : this.prisma.userPersona.findFirst({
                  where: { projectId },
                }),
          ])

          if (!story) {
            subscriber.error(new NotFoundException('User story not found.'))
            return
          }
          if (personaId && !persona) {
            subscriber.error(
              new BadRequestException(
                'personaId must be a persona of this project.',
              ),
            )
            return
          }

          subscriber.next({
            data: {
              status: 'Drafting your prompt with AI...',
              stage: 'loading_inputs',
            },
          })

          const defaultGoal =
            story.acceptanceCriteria ||
            story.title ||
            'Complete the primary user workflow successfully.'
          const defaultProblem =
            story.problemStatement ||
            'Users need a more efficient way to accomplish this task.'
          const ds = intent?.designSystem === 'MUI' ? 'Material UI' : 'shadcn'
          const standard = intent?.designStandards?.[0] || 'WCAG 2.2 AA'
          const color = intent?.primaryColor || '#F2652A'
          const defaultMustUse = `Use ${ds} components only and meet ${standard}. Use ${color} for primary actions. Keep copy plain and friendly, and provide clear user feedback.`

          subscriber.next({
            data: {
              status: 'Drafting your prompt with AI...',
              stage: 'drafting',
            },
          })

          if (!this.llm.configured) {
            subscriber.error(
              new BadRequestException(
                'LLM provider is not configured on the backend. Please verify LLM_BASE_URL and LLM_API_KEY.',
              ),
            )
            return
          }

          let lastSent = 0
          const THROTTLE_MS = 400

          const completion = await this.llm.structured({
            schemaName: 'StructuredPromptReview',
            schema: DRAFT_PROMPT_JSON_SCHEMA,
            signal: abortController.signal,
            model: this.llm.analysisModel,
            messages: [
              {
                role: 'system',
                content:
                  'You are an expert UX design strategist. Your task is to draft a structured prompt for A/B UI variant generation based on the user story, design intent, and persona. Keep Variant A and B differing in exactly one key dimension (e.g. single-page direct flow vs staged guided flow).',
              },
              {
                role: 'user',
                content: JSON.stringify({
                  userStory: {
                    title: story.title,
                    description: story.description,
                    problemStatement: story.problemStatement,
                    acceptanceCriteria: story.acceptanceCriteria,
                  },
                  designIntent: intent
                    ? {
                        statement: intent.statement,
                        designSystem: intent.designSystem,
                        designStandards: intent.designStandards,
                        primaryColor: intent.primaryColor,
                        secondaryColor: intent.secondaryColor,
                        accentColor: intent.accentColor,
                        brandGuidelines: intent.brandGuidelines,
                        toneOfVoice: intent.toneOfVoice,
                      }
                    : null,
                  persona: persona
                    ? {
                        name: persona.name,
                        age: persona.age,
                        shortDescription: persona.shortDescription,
                        frustrations: persona.frustrations,
                        goals: persona.goals,
                      }
                    : null,
                  defaults: {
                    goal: defaultGoal,
                    problem: defaultProblem,
                    mustUse: defaultMustUse,
                  },
                }),
              },
            ],
            onThoughtDelta: (_chunk, totalThought) => {
              const now = Date.now()
              if (now - lastSent < THROTTLE_MS) {
                return
              }
              lastSent = now
              subscriber.next({
                data: {
                  status: 'Reasoning about prompt strategy...',
                  stage: 'llm_streaming',
                  thought: totalThought,
                },
              })
            },
            onDelta: (chars) => {
              const now = Date.now()
              if (now - lastSent < THROTTLE_MS) {
                return
              }
              lastSent = now
              subscriber.next({
                data: {
                  status: 'Drafting your prompt with AI...',
                  stage: 'llm_streaming',
                  charsReceived: chars,
                },
              })
            },
          })

          const parsed = parseDraftPrompt(
            completion.content,
            completion.finishReason,
          )
          subscriber.next({
            data: {
              status: 'Drafting complete',
              stage: 'completed',
              prompt: parsed,
            },
          })
          subscriber.complete()
        } catch (err: unknown) {
          this.logger.error('Error drafting prompt via LLM', err)
          subscriber.error(err)
        }
      })()

      return () => {
        abortController.abort()
      }
    })
  }
}
