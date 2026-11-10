process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.JWT_ACCESS_SECRET = 'e2e-secret-e2e-secret-e2e-secret-e2e-secret'
process.env.GOOGLE_CLIENT_ID = 'e2e-client-id'
process.env.GOOGLE_CLIENT_SECRET = 'e2e-client-secret'
process.env.GOOGLE_CALLBACK_URL =
  'http://localhost:4000/api/auth/google/callback'
// Mocks answer differently per test; a cached response would leak between
// tests. test/cache.e2e-spec.ts turns caching on explicitly.
process.env.CACHE_TTL_SECONDS = '0'
