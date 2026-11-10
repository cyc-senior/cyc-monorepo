import { applyDecorators } from '@nestjs/common'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsObject, IsOptional } from 'class-validator'

const SCHEMA = { type: 'object', additionalProperties: true } as const

/** Optional free-form JSON object on a request DTO. */
export const JsonInput = (description?: string) =>
  applyDecorators(
    ApiPropertyOptional({ ...SCHEMA, description }),
    IsOptional(),
    IsObject(),
  )

/** Required free-form JSON object on a request DTO. */
export const RequiredJsonInput = (description?: string) =>
  applyDecorators(ApiProperty({ ...SCHEMA, description }), IsObject())

/** Free-form JSON object on a response DTO. */
export const JsonOutput = (description?: string) =>
  ApiProperty({ ...SCHEMA, description })
