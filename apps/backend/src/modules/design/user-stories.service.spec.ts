import { PrismaService } from '../../prisma/prisma.service'
import { UserStoriesService } from './user-stories.service'

describe('UserStoriesService soft delete', () => {
  const story = {
    id: 's-1',
    projectId: 'p-1',
    title: 'Book a room',
    personas: [],
    rounds: [],
  }
  const prisma = {
    userStory: {
      findFirstOrThrow: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn((args: unknown) => args),
    },
    generationJob: {
      updateMany: jest.fn((args: unknown) => args),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  }
  const service = new UserStoriesService(prisma as unknown as PrismaService)

  beforeEach(() => {
    jest.clearAllMocks()
    prisma.userStory.findFirstOrThrow.mockResolvedValue(story)
  })

  it('marks the story deleted instead of removing it', async () => {
    await service.remove('p-1', 's-1', 'u-1')

    expect(prisma.userStory.update).toHaveBeenCalledWith({
      where: { id: 's-1' },
      data: { deletedAt: expect.any(Date), deletedById: 'u-1' },
    })
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
  })

  it('cancels the queued and running generations of its rounds', async () => {
    await service.remove('p-1', 's-1', 'u-1')

    expect(prisma.generationJob.updateMany).toHaveBeenCalledWith({
      where: {
        round: { storyId: 's-1', projectId: 'p-1' },
        status: { in: ['QUEUED', 'RUNNING'] },
      },
      data: { status: 'CANCELLED', finishedAt: expect.any(Date) },
    })
  })

  it('only finds stories that are not deleted', async () => {
    await service.get('p-1', 's-1')

    expect(prisma.userStory.findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's-1', projectId: 'p-1', deletedAt: null },
      }),
    )
  })

  it('leaves deleted stories out of the list', async () => {
    prisma.userStory.findMany.mockResolvedValue([])
    prisma.userStory.count.mockResolvedValue(0)

    await service.list('p-1', { limit: 20, offset: 0 } as never)

    expect(prisma.userStory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    )
    expect(prisma.userStory.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ deletedAt: null }),
    })
  })
})
