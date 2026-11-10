import { applyDecorators, Type as ClassType } from '@nestjs/common'
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, Max, Min } from 'class-validator'

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0
}

export class PageMetaDto {
  /** Total rows matching the filters. */
  total: number

  limit: number

  offset: number
}

export interface Page<T> {
  data: T[]
  total: number
  limit: number
  offset: number
}

/**
 * Runs a page query and its count together and wraps them in the standard
 * envelope returned by every list endpoint.
 */
export async function paginate<T>(
  query: PaginationQueryDto,
  find: (page: { skip: number; take: number }) => Promise<T[]>,
  count: () => Promise<number>,
): Promise<Page<T>> {
  const { limit, offset } = query
  const [data, total] = await Promise.all([
    find({ skip: offset, take: limit }),
    count(),
  ])

  return { data, total, limit, offset }
}

/** Documents a list endpoint as `{ data: Model[], total, limit, offset }`. */
export const ApiPaginatedResponse = (model: ClassType<unknown>) =>
  applyDecorators(
    ApiExtraModels(PageMetaDto, model),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(PageMetaDto) },
          {
            properties: {
              data: { type: 'array', items: { $ref: getSchemaPath(model) } },
            },
            required: ['data'],
          },
        ],
      },
    }),
  )
