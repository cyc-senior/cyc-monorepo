import { NestFactory } from '@nestjs/core'

import { AppModule } from '../src/app.module'
import { AuthService } from '../src/modules/auth/auth.service'
import { PrismaService } from '../src/prisma/prisma.service'
import { assertDevelopment } from './lib/dev-only'
import { adminEmail } from './lib/dev-config'

/**
 * Usage: pnpm --filter backend dev:token [--email <email>] [--raw]
 *   --email  user to sign in as (default: the seeded admin)
 *   --raw    print only the access token, for use in shell substitution
 */
async function main() {
  assertDevelopment()

  const args = process.argv.slice(2)
  const raw = args.includes('--raw')
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

    if (raw) {
      process.stdout.write(`${tokens.accessToken}\n`)
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
      ].join('\n'),
    )
  } finally {
    await app.close()
  }
}
void main()
