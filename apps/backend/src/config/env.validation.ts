import { plainToInstance } from 'class-transformer'
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  Min,
  MinLength,
  validateSync,
} from 'class-validator'

export class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: string = 'development'

  @IsInt()
  @Min(1)
  PORT: number = 4000

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET: string

  @IsInt()
  @Min(1)
  JWT_ACCESS_TTL_SECONDS: number = 900

  @IsInt()
  @Min(1)
  REFRESH_TOKEN_TTL_DAYS: number = 30

  @IsString()
  @IsNotEmpty()
  GOOGLE_CLIENT_ID: string

  @IsString()
  @IsNotEmpty()
  GOOGLE_CLIENT_SECRET: string

  @IsUrl({ require_tld: false })
  GOOGLE_CALLBACK_URL: string
}

/**
 * Validates and coerces the raw environment for `ConfigModule`.
 *
 * @param config - Raw key/value environment (e.g. `process.env` plus `.env`).
 * @returns The typed environment with defaults applied.
 * @throws Error listing every invalid variable, or any `.env.example`
 *   placeholder left in production, so startup fails fast.
 */
export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  })
  const errors = validateSync(validated, { skipMissingProperties: false })

  if (errors.length > 0) {
    throw new Error(`Invalid environment variables:\n${errors.toString()}`)
  }

  if (validated.NODE_ENV === 'production') {
    assertNoPlaceholders(validated)
  }

  return validated
}

/** Values copied from `.env.example` that must never reach production. */
function assertNoPlaceholders(env: EnvironmentVariables): void {
  const placeholders = [
    env.JWT_ACCESS_SECRET.startsWith('change-me') && 'JWT_ACCESS_SECRET',
    env.GOOGLE_CLIENT_ID === 'local-dev-placeholder' && 'GOOGLE_CLIENT_ID',
    env.GOOGLE_CLIENT_SECRET === 'local-dev-placeholder' &&
      'GOOGLE_CLIENT_SECRET',
  ].filter(Boolean)

  if (placeholders.length > 0) {
    throw new Error(
      `Placeholder values from .env.example are not allowed in production: ${placeholders.join(', ')}`,
    )
  }
}
