export const DEFAULT_ADMIN_EMAIL = 'admin@senior.local'

export function adminEmail(): string {
  return process.env.DEV_ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL
}
