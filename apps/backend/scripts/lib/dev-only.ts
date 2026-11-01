import 'dotenv/config'

/**
 * Dev scripts mint credentials without Google, so they must never run against
 * staging or production. NODE_ENV has to be explicitly set to "development"
 * (an unset value is refused), and there is no matching HTTP endpoint.
 */
export function assertDevelopment(): void {
  if (process.env.NODE_ENV !== 'development') {
    process.stderr.write(
      `Refusing to run: NODE_ENV is "${process.env.NODE_ENV ?? ''}", ` +
        'expected "development". This script is for local development only.\n',
    )
    process.exit(1)
  }
}
