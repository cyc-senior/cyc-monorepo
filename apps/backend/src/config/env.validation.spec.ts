import 'reflect-metadata'

import { validateEnv } from './env.validation'

describe('validateEnv', () => {
  const base = {
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

  it('allows the .env.example placeholders outside production', () => {
    expect(() =>
      validateEnv({
        ...base,
        JWT_ACCESS_SECRET: 'change-me-to-a-long-random-string',
        GOOGLE_CLIENT_ID: 'local-dev-placeholder',
        GOOGLE_CLIENT_SECRET: 'local-dev-placeholder',
      }),
    ).not.toThrow()
  })

  it('rejects the .env.example placeholders in production', () => {
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'change-me-to-a-long-random-string',
        GOOGLE_CLIENT_ID: 'local-dev-placeholder',
        GOOGLE_CLIENT_SECRET: 'local-dev-placeholder',
      }),
    ).toThrow('JWT_ACCESS_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET')
  })
})
