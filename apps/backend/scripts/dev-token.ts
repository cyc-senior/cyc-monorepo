import { NestFactory } from '@nestjs/core'

import { AppModule } from '../src/app.module'
import { AuthService } from '../src/modules/auth/auth.service'
import { PrismaService } from '../src/prisma/prisma.service'
import { assertDevelopment } from './lib/dev-only'
import { adminEmail } from './lib/dev-config'

/**
 * Issues a real access/refresh token pair for an existing user, bypassing
 * Google. Development only (see `assertDevelopment`).
 *
 * Usage: pnpm dev:token [--email <email>] [--raw | --url]
 *   --email  user to sign in as (default: the seeded admin)
 *   --raw    print only the access token, for use in shell substitution
 *   --url    print only a frontend sign-in link (`/auth/dev`) that logs the
 *            browser in as that user (see `pnpm dev:url`)
 */
async function main() {
  assertDevelopment()

  const args = process.argv.slice(2)
  const raw = args.includes('--raw')
  const urlOnly = args.includes('--url')
  const emailFlag = args.indexOf('--email')
  const email = emailFlag === -1 ? adminEmail() : args[emailFlag + 1]

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  })

  try {
    const user = await app
      .get(PrismaService)
      .user.findUnique({ where: { email } })
    if (!user) {
      process.stderr.write(
        `No user with email "${email}". Run \`pnpm --filter backend db:seed\` first.\n`,
      )
      process.exitCode = 1
      return
    }

    const tokens = await app
      .get(AuthService)
      .issueTokens({ id: user.id, email: user.email })

    // The refresh token goes in the fragment so it is never sent to a server.
    const frontendUrl = (
      process.env.FRONTEND_URL ?? 'http://localhost:3000'
    ).replace(/\/$/, '')
    const signInUrl = `${frontendUrl}/auth/dev#refreshToken=${encodeURIComponent(tokens.refreshToken)}`

    if (raw) {
      process.stdout.write(`${tokens.accessToken}\n`)
      return
    }
    if (urlOnly) {
      process.stdout.write(`${signInUrl}\n`)
      return
    }
    process.stdout.write(
      [
        `Signed in as ${user.email} (expires in ${tokens.expiresIn}s)`,
        '',
        `access token:  ${tokens.accessToken}`,
        `refresh token: ${tokens.refreshToken}`,
        '',
        'Use it as: Authorization: Bearer <access token>',
        '',
        'Browser sign-in (single use):',
        signInUrl,
        '',
      ].join('\n'),
    )
  } finally {
    await app.close()
  }
}
void main()
