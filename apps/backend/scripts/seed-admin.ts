import { NestFactory } from '@nestjs/core'

import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma/prisma.service'
import { assertDevelopment } from './lib/dev-only'
import { adminEmail } from './lib/dev-config'

/** Creates the dev admin user if missing; safe to run repeatedly. */
async function main() {
  assertDevelopment()

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  })

  try {
    const email = adminEmail()
    const admin = await app.get(PrismaService).user.upsert({
      where: { email },
      update: {},
      create: { email, emailVerified: true, name: 'Admin' },
    })
    process.stdout.write(`Admin user ready: ${admin.email} (${admin.id})\n`)
  } finally {
    await app.close()
  }
}
void main()
