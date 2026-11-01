import 'reflect-metadata'

import { validateEnv } from './env.validation'

describe('validateEnv', () => {
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
})
