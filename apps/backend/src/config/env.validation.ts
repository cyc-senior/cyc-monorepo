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
  /** Required on purpose: an omitted value must not silently mean "development". */
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: string

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
 * @throws Error listing every invalid variable (including an omitted
 *   `NODE_ENV`), a published example signing key in any environment, or
 *   Google placeholders in production, so startup fails fast.
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

  if (validated.JWT_ACCESS_SECRET.startsWith(WEAK_SECRET_PREFIX)) {
    throw new Error(
      'JWT_ACCESS_SECRET is a published example value; generate a real one ' +
        '(`pnpm env:init` or `openssl rand -base64 48`).',
    )
  }
  if (validated.NODE_ENV === 'production') {
    assertNoPlaceholders(validated)
  }

  return validated
}

/** Example values that are never acceptable as a signing key, in any env. */
const WEAK_SECRET_PREFIX = 'change-me'

/** Google placeholders from `.env.example` that must never reach production. */
function assertNoPlaceholders(env: EnvironmentVariables): void {
  const placeholders = [
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
