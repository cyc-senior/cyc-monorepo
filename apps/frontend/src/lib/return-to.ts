/**
 * Remembers the page a signed-out visitor was sent away from, so any sign-in
 * method (Google, dev link, …) can bring them back. Kept in localStorage
 * because the dev sign-in link usually opens in a new tab.
 */
const KEY = "cyc:return-to";
/** A remembered page older than this is ignored. */
const MAX_AGE_MS = 30 * 60 * 1000;
const AUTH_PAGES = ["/signin", "/signup", "/forgot-password", "/auth/"];

function isSafePath(path: string): boolean {
  return (
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !AUTH_PAGES.some((p) => path === p || path.startsWith(p))
  );
}

let signingOut = false;

/** A deliberate sign-out: don't bring the next sign-in back to this page. */
export function forgetReturnTo(): void {
  signingOut = true;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to forget.
  }
}

export function rememberReturnTo(path: string): void {
  if (signingOut) {
    signingOut = false;
    return;
  }
  if (!isSafePath(path)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {
    // Storage can be blocked; signing in then lands on the dashboard.
  }
}

/** The remembered page, once; null when there is none (or it is stale). */
export function consumeReturnTo(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    if (!raw) return null;
    const { path, at } = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (typeof path !== "string" || typeof at !== "number") return null;
    if (Date.now() - at > MAX_AGE_MS || !isSafePath(path)) return null;
    return path;
  } catch {
    return null;
  }
}
