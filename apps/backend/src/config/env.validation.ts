import { plainToInstance, Transform } from 'class-transformer'
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator'

/** `"true"`/`"false"` from the environment (implicit conversion would make `"false"` true). */
const EnvBoolean = () =>
  Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
    const raw = obj[key]

    return raw === undefined ? undefined : raw === true || raw === 'true'
  })

const LOG_LEVELS = [
  'fatal',
  'error',
  'warn',
  'log',
  'debug',
  'verbose',
] as const

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

  /** Web app origin, allowed by CORS (the frontend calls the API and its event streams). */
  @IsUrl({ require_tld: false, require_protocol: true })
  FRONTEND_URL: string = 'http://localhost:3000'

  /**
   * Response cache and the design-generation queue (BullMQ). Required in
   * production; elsewhere the cache falls back to an in-process store and the
   * queue to `redis://localhost:6379`.
   */
  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ['redis', 'rediss'] })
  REDIS_URL?: string

  /** How long a cached GET response lives. `0` disables response caching. */
  @IsInt()
  @Min(0)
  CACHE_TTL_SECONDS: number = 60

  /** Least severe level written; each level includes all more severe ones. */
  @IsIn(LOG_LEVELS)
  LOG_LEVEL: (typeof LOG_LEVELS)[number] = 'log'

  /** Defaults to `json` in production and `pretty` elsewhere. */
  @IsOptional()
  @IsIn(['json', 'pretty'])
  LOG_FORMAT?: 'json' | 'pretty'

  /** Database queries slower than this are logged as warnings. */
  @IsInt()
  @Min(1)
  SLOW_QUERY_MS: number = 500

  /** OpenAI-compatible endpoint used for design generation. */
  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  LLM_BASE_URL?: string

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  LLM_API_KEY?: string

  /** Must support JSON-schema structured output. */
  @IsString()
  @IsNotEmpty()
  LLM_MODEL: string = 'qwen3.8-27b'

  /** Per LLM request. */
  @IsInt()
  @Min(1000)
  LLM_TIMEOUT_MS: number = 300_000

  @IsInt()
  @Min(1000)
  LLM_MAX_TOKENS: number = 16_000

  /** Turn off the model's reasoning phase (vLLM `enable_thinking: false`): much faster for structured output. */
  @EnvBoolean()
  @IsBoolean()
  LLM_DISABLE_THINKING: boolean = true

  /** How many times the model may repair a design that fails the UI kit or WCAG checks. */
  @IsInt()
  @Min(0)
  @Max(5)
  DESIGN_REPAIR_ATTEMPTS: number = 2

  /**
   * Namespace of the job queues in Redis. Environments sharing a Redis (or a
   * developer's machine running two databases) need different prefixes, or
   * their workers take each other's jobs.
   */
  @IsString()
  @IsNotEmpty()
  QUEUE_PREFIX: string = 'senior'

  /** Run the generation worker in this process (turn off on API-only instances). */
  @EnvBoolean()
  @IsBoolean()
  GENERATION_WORKER: boolean = true

  /** Longest life of a tester (session participant) access token; it also ends with the session. */
  @IsInt()
  @Min(60)
  TESTER_TOKEN_TTL_SECONDS: number = 14_400

  /**
   * The API sits behind one reverse proxy (client IPs come from
   * `X-Forwarded-For`). Needed for per-client rate limits to see real IPs.
   */
  @EnvBoolean()
  @IsBoolean()
  TRUST_PROXY: boolean = false

  /** Serve the Swagger UI and `/api-json`. Defaults to on, except in production. */
  @IsOptional()
  @EnvBoolean()
  @IsBoolean()
  SWAGGER_ENABLED?: boolean

  /** Model for feedback analysis and story drafting (proposal: qwen3.8-27b). */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  LLM_ANALYSIS_MODEL?: string

  /** Generation jobs one worker runs at once. */
  @IsInt()
  @Min(1)
  @Max(16)
  GENERATION_CONCURRENCY: number = 2
}

/**
 * Validates and coerces the raw environment for `ConfigModule`.
 *
 * @param config - Raw key/value environment (e.g. `process.env` plus `.env`).
 * @returns The typed environment with defaults applied.
 * @throws Error listing every invalid variable (including an omitted
 *   `NODE_ENV`), a published example signing key in any environment, or
 *   Google placeholders or a missing `REDIS_URL` in production, so startup
 *   fails fast.
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
    if (!validated.REDIS_URL) {
      // Per-process caches would disagree across instances and never be
      // invalidated by writes handled elsewhere; the queue needs it anyway.
      throw new Error('REDIS_URL is required in production.')
    }
    if (
      validated.GENERATION_WORKER &&
      (!validated.LLM_BASE_URL || !validated.LLM_API_KEY)
    ) {
      throw new Error(
        'LLM_BASE_URL and LLM_API_KEY are required in production when GENERATION_WORKER is on.',
      )
    }
  }
  validated.SWAGGER_ENABLED ??= validated.NODE_ENV !== 'production'
  validated.LOG_FORMAT ??=
    validated.NODE_ENV === 'production' ? 'json' : 'pretty'

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
