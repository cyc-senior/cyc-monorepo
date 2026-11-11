import { redactUrl } from './request-logger.middleware'

describe('redactUrl', () => {
  const TOKEN = 'Qm9hcmQtc2VjcmV0LXRva2VuLXdpdGgtMjU2LWJpdHM'

  it('masks link secrets in the path', () => {
    expect(redactUrl(`/api/public/invites/${TOKEN}/join`)).toBe(
      '/api/public/invites/[redacted]/join',
    )
    expect(redactUrl(`/api/public/reports/${TOKEN}`)).toBe(
      '/api/public/reports/[redacted]',
    )
  })

  it('keeps ids and ordinary segments', () => {
    const path = '/api/projects/6b1c3f0e-2a43-4a6e-9a43-0c1c4f1d9a11/rounds'

    expect(redactUrl(path)).toBe(path)
  })

  it('masks secret query values but keeps the rest', () => {
    expect(
      redactUrl('/api/auth/google/callback?code=4/abc&scope=email&state=x'),
    ).toBe(
      '/api/auth/google/callback?code=[redacted]&scope=email&state=[redacted]',
    )
    expect(redactUrl('/api/projects?limit=10&offset=20')).toBe(
      '/api/projects?limit=10&offset=20',
    )
  })
})
