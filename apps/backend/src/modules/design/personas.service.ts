import { Injectable } from '@nestjs/common'

import { Page, paginate } from '../../common/dto/pagination.dto'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import {
  CreatePersonaDto,
  PersonaDto,
  PersonaQueryDto,
  UpdatePersonaDto,
} from './dto/persona.dto'

/** User personas of a project (Organization → Project → User Persona). */
@Injectable()
export class PersonasService {
  constructor(private readonly prisma: PrismaService) {}

  list(projectId: string, query: PersonaQueryDto): Promise<Page<PersonaDto>> {
    const where: Prisma.UserPersonaWhereInput = {
      projectId,
      origin: query.origin,
    }

    return paginate(
      query,
      (page) =>
        this.prisma.userPersona.findMany({
          where,
          orderBy: { createdAt: 'asc' },
          ...page,
        }),
      () => this.prisma.userPersona.count({ where }),
    )
  }

  create(projectId: string, dto: CreatePersonaDto): Promise<PersonaDto> {
    return this.prisma.userPersona.create({
      data: {
        projectId,
        origin: 'MANUAL',
        name: dto.name,
        age: dto.age,
        shortDescription: dto.shortDescription,
        behavioralConsiderations: dto.behavioralConsiderations ?? [],
        frustrations: dto.frustrations ?? [],
        goals: dto.goals ?? [],
        tasks: dto.tasks ?? [],
      },
    })
  }

  get(projectId: string, id: string): Promise<PersonaDto> {
    return this.prisma.userPersona.findFirstOrThrow({
      where: { id, projectId },
    })
  }

  /** Designers can edit any persona, including AI artifacts (their origin stays AI). */
  async update(
    projectId: string,
    id: string,
    dto: UpdatePersonaDto,
  ): Promise<PersonaDto> {
    await this.get(projectId, id)

    return this.prisma.userPersona.update({ where: { id }, data: dto })
  }

  async remove(projectId: string, id: string): Promise<void> {
    await this.get(projectId, id)
    await this.prisma.userPersona.delete({ where: { id } })
  }
}
