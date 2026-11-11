import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

import { PaginationQueryDto } from '../../../common/dto/pagination.dto'
import { PersonaOrigin } from '../../../generated/prisma/client'

const List = (example: string[]) =>
  function (target: object, key: string) {
    ApiPropertyOptional({ type: [String], example })(target, key)
    IsOptional()(target, key)
    IsArray()(target, key)
    ArrayMaxSize(10)(target, key)
    IsString({ each: true })(target, key)
    IsNotEmpty({ each: true })(target, key)
    MaxLength(300, { each: true })(target, key)
  }

/** A user persona of the project. */
export class CreatePersonaDto {
  /** @example 'Nina Park' */
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  age?: number

  /** @example 'Busy parent who shops on her phone during her commute.' */
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  shortDescription: string

  @List(['Shops in short bursts', 'Abandons long forms'])
  behavioralConsiderations?: string[]

  @List(['Re-entering card details', 'Surprise delivery fees'])
  frustrations?: string[]

  @List(['Check out in under a minute'])
  goals?: string[]

  @List(['Reorder last week’s groceries'])
  tasks?: string[]
}

export class UpdatePersonaDto extends PartialType(CreatePersonaDto) {}

export class PersonaQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PersonaOrigin, enumName: 'PersonaOrigin' })
  @IsOptional()
  @IsEnum(PersonaOrigin)
  origin?: PersonaOrigin
}

export class PersonaDto {
  @ApiProperty({ format: 'uuid' })
  id: string

  @ApiProperty({ format: 'uuid' })
  projectId: string

  /** MANUAL = written by a designer; AI = persona artifact synthesized from a design prompt. */
  @ApiProperty({ enum: PersonaOrigin, enumName: 'PersonaOrigin' })
  origin: PersonaOrigin

  /** For AI personas: the generation job whose prompt produced it. */
  @ApiProperty({ format: 'uuid' })
  generationJobId: string | null

  name: string

  age: number | null

  shortDescription: string

  behavioralConsiderations: string[]

  frustrations: string[]

  goals: string[]

  tasks: string[]

  createdAt: Date

  updatedAt: Date
}
