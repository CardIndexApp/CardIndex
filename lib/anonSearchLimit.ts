/**
 * Anonymous search rate-limiter — client-side, localStorage-backed.
 *
 * Allows LIMIT free searches per WINDOW_MS for users who are not signed in.
 * Cached results don't count toward the limit (only fresh API calls do).
 *
 * The window resets automatically once the hour is up, so the user can
 * search again without clearing anything.
 */

const KEY       = 'ci_anon_srch'
const WINDOW_MS = 60 * 60 * 1000  // 1 hour
const LIMIT     = 1

interface AnonUsage {
  count: number
  windowStart: number  // unix ms
}

function read(): AnonUsage {
  if (typeof window === 'undefined') return { count: 0, windowStart: Date.now() }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { count: 0, windowStart: Date.now() }
    const parsed = JSON.parse(raw) as AnonUsage
    // Expired window → fresh slate
    if (Date.now() - parsed.windowStart > WINDOW_MS) {
      return { count: 0, windowStart: Date.now() }
    }
    return parsed
  } catch {
    return { count: 0, windowStart: Date.now() }
  }
}

/** Returns true if the anonymous user has used up their free searches. */
export function anonLimitReached(): boolean {
  return read().count >= LIMIT
}

/** Call after a fresh (non-cached) search completes successfully. */
export function incrementAnonSearchCount(): void {
  if (typeof window === 'undefined') return
  try {
    const usage = read()
    localStorage.setItem(KEY, JSON.stringify({
      count: usage.count + 1,
      windowStart: usage.windowStart,
    }))
  } catch {}
}

/**
 * How many milliseconds remain in the current window.
 * Returns 0 if the window has expired.
 */
export function anonWindowRemainingMs(): number {
  const usage = read()
  return Math.max(0, WINDOW_MS - (Date.now() - usage.windowStart))
}

/**
 * Clear the anon search counter entirely.
 * Call this when a user logs in so that any previous anon usage on this
 * device is not inherited by the logged-in session (or a later anon session
 * that shares the same IP / device).
 */
export function clearAnonSearchCount(): void {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(KEY) } catch {}
}
