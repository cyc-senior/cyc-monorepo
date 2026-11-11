import { createHash, randomBytes, randomInt } from 'node:crypto'

/** SHA-256 hex digest; the only form in which bearer-style secrets are stored. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/** URL-safe random secret with 256 bits of entropy. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

// No 0/O/1/I/L: codes get read aloud and typed by hand.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** Human-friendly random code such as `K7MQ-4XPD`. */
export function generateAccessCode(): string {
  const chars = Array.from(
    { length: 8 },
    () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
  )

  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`
}
