import { applyDecorators } from '@nestjs/common'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsEmail, IsOptional, MaxLength } from 'class-validator'

const normalise = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value,
)

/**
 * An email address, trimmed and lower-cased so the same person is always
 * matched (testers are identified by email).
 */
export const EmailField = (options: { optional?: boolean } = {}) =>
  applyDecorators(
    ...(options.optional
      ? [
          ApiPropertyOptional({
            format: 'email',
            example: 'tester@example.com',
          }),
          IsOptional(),
        ]
      : [ApiProperty({ format: 'email', example: 'tester@example.com' })]),
    normalise,
    IsEmail(),
    MaxLength(254),
  )
