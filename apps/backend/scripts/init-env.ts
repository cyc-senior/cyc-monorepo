import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Creates `apps/backend/.env` from `.env.example` with a freshly generated
 * JWT signing secret, so no signing key is ever shared between checkouts.
 * Refuses to overwrite an existing `.env`.
 */
function main() {
  const root = join(__dirname, '..')
  const target = join(root, '.env')

  if (existsSync(target)) {
    process.stderr.write('.env already exists; leaving it untouched.\n')
    process.exitCode = 1
    return
  }

  const secret = randomBytes(48).toString('base64')
  const contents = readFileSync(join(root, '.env.example'), 'utf8').replace(
    /^JWT_ACCESS_SECRET=.*$/m,
    `JWT_ACCESS_SECRET=${secret}`,
  )
  writeFileSync(target, contents, { mode: 0o600 })
  process.stdout.write(
    'Created apps/backend/.env with a generated JWT secret.\n',
  )
}
main()
