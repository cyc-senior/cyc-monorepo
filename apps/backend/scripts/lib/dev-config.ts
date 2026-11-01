export const DEFAULT_ADMIN_EMAIL = 'admin@senior.local'

/** Email of the dev admin user: `DEV_ADMIN_EMAIL`, or the default. */
export function adminEmail(): string {
  return process.env.DEV_ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL
}
