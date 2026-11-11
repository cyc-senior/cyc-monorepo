import 'reflect-metadata'

import { validateEnv } from './env.validation'

describe('validateEnv', () => {
  const llm = {
    LLM_BASE_URL: 'https://llm.example.com/v1',
    LLM_API_KEY: 'sk-test',
  }
  const base = {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    JWT_ACCESS_SECRET: 'a-real-secret-that-is-at-least-32-chars',
    GOOGLE_CLIENT_ID: 'real-id',
    GOOGLE_CLIENT_SECRET: 'real-secret',
    GOOGLE_CALLBACK_URL: 'https://api.example.com/api/auth/google/callback',
  }

  it('applies defaults and coerces numbers', () => {
    const env = validateEnv({ ...base, PORT: '5000' })

    expect(env.PORT).toBe(5000)
    expect(env.NODE_ENV).toBe('development')
    expect(env.REFRESH_TOKEN_TTL_DAYS).toBe(30)
  })

  it('rejects a missing required variable', () => {
    expect(() => validateEnv({ ...base, DATABASE_URL: undefined })).toThrow(
      'DATABASE_URL',
    )
  })

  it('rejects a short JWT secret', () => {
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: 'short' })).toThrow(
      'JWT_ACCESS_SECRET',
    )
  })

  it('requires NODE_ENV instead of defaulting to development', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: undefined })).toThrow(
      'NODE_ENV',
    )
  })

  it.each(['development', 'test', 'production'])(
    'rejects the published example JWT secret when NODE_ENV=%s',
    (NODE_ENV) => {
      expect(() =>
        validateEnv({
          ...base,
          NODE_ENV,
          JWT_ACCESS_SECRET: 'change-me-to-a-long-random-string',
        }),
      ).toThrow('published example value')
    },
  )

  it('allows the Google placeholders outside production', () => {
    expect(() =>
      validateEnv({
        ...base,
        GOOGLE_CLIENT_ID: 'local-dev-placeholder',
        GOOGLE_CLIENT_SECRET: 'local-dev-placeholder',
      }),
    ).not.toThrow()
  })

  it('rejects the Google placeholders in production', () => {
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        GOOGLE_CLIENT_ID: 'local-dev-placeholder',
        GOOGLE_CLIENT_SECRET: 'local-dev-placeholder',
      }),
    ).toThrow('GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET')
  })

  it('requires Redis in production only', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow(
      'REDIS_URL is required in production',
    )
    expect(
      validateEnv({
        ...base,
        ...llm,
        NODE_ENV: 'production',
        REDIS_URL: 'rediss://cache.internal:6380',
      }).REDIS_URL,
    ).toBe('rediss://cache.internal:6380')
    expect(validateEnv(base).REDIS_URL).toBeUndefined()
  })

  it('requires the LLM in production unless the worker runs elsewhere', () => {
    const prod = { ...base, NODE_ENV: 'production', REDIS_URL: 'redis://r' }

    expect(() => validateEnv(prod)).toThrow('LLM_BASE_URL and LLM_API_KEY')
    expect(validateEnv({ ...prod, ...llm }).LLM_MODEL).toBe('qwen3.8-27b')
    expect(
      validateEnv({ ...prod, GENERATION_WORKER: 'false' }).GENERATION_WORKER,
    ).toBe(false)
  })

  it('reads boolean flags from strings', () => {
    expect(validateEnv(base).LLM_DISABLE_THINKING).toBe(true)
    expect(
      validateEnv({ ...base, LLM_DISABLE_THINKING: 'false' })
        .LLM_DISABLE_THINKING,
    ).toBe(false)
    expect(() => validateEnv({ ...base, DESIGN_REPAIR_ATTEMPTS: '9' })).toThrow(
      'DESIGN_REPAIR_ATTEMPTS',
    )
  })

  it('rejects a non-Redis cache URL', () => {
    expect(() =>
      validateEnv({ ...base, REDIS_URL: 'http://localhost:6379' }),
    ).toThrow('REDIS_URL')
  })

  it('defaults to JSON logs in production and pretty logs elsewhere', () => {
    const prod = {
      ...base,
      ...llm,
      NODE_ENV: 'production',
      REDIS_URL: 'redis://r',
    }

    expect(validateEnv(prod).LOG_FORMAT).toBe('json')
    expect(validateEnv(base).LOG_FORMAT).toBe('pretty')
    expect(validateEnv({ ...base, LOG_FORMAT: 'json' }).LOG_FORMAT).toBe('json')
    expect(() => validateEnv({ ...base, LOG_LEVEL: 'loud' })).toThrow(
      'LOG_LEVEL',
    )
  })
})
