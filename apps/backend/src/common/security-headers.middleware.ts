import { NextFunction, Request, Response } from 'express'

/**
 * Baseline response headers for an API that serves personal data: no MIME
 * sniffing, no framing, no referrer leakage (invitation links carry secrets in
 * the fragment, and URLs of the API must not travel), no caching of responses
 * by browsers or proxies, and HSTS when the deployment is HTTPS (production).
 */
export function securityHeaders(options: { hsts: boolean }) {
  return (_request: Request, response: Response, next: NextFunction): void => {
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('X-Frame-Options', 'DENY')
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    )
    if (options.hsts) {
      response.setHeader(
        'Strict-Transport-Security',
        'max-age=15552000; includeSubDomains',
      )
    }
    next()
  }
}
