import { sha256 } from '../../common/crypto'

/**
 * Invitation codes are typed and copied by hand, and clients uppercase them
 * for display. Normalizing here makes storage, lookup and display agree;
 * the token stays unguessable (256 bits of entropy before normalization).
 */
export function normalizeInviteToken(token: string): string {
  return token.trim().toLowerCase()
}

/** The only form of an invitation token that may be stored or looked up. */
export function hashInviteToken(token: string): string {
  return sha256(normalizeInviteToken(token))
}

/** How the code is shown to people. */
export function displayInviteCode(token: string): string {
  return normalizeInviteToken(token).toUpperCase()
}
