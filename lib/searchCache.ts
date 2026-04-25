/**
 * Client-side 24-hour search result cache backed by localStorage.
 *
 * Keys are namespaced with "ci_srch:" so they're easy to identify and
 * won't collide with other localStorage entries.
 *
 * Storage failures (private browsing quota exceeded, etc.) are swallowed
 * silently — the app simply falls back to a live fetch.
 */

const PREFIX = 'ci_srch:'
const TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

interface CacheEntry<T> {
  data: T
  cachedAt: number // unix ms
}

/** Retrieve a cached value. Returns null if missing, expired, or unreadable. */
export function cacheGet<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry<T>
    if (Date.now() - entry.cachedAt > TTL_MS) {
      localStorage.removeItem(PREFIX + key)
      return null
    }
    return entry.data
  } catch {
    return null
  }
}

/** Store a value. Silently no-ops if localStorage is unavailable. */
export function cacheSet<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return
  try {
    const entry: CacheEntry<T> = { data, cachedAt: Date.now() }
    localStorage.setItem(PREFIX + key, JSON.stringify(entry))
  } catch {
    // Quota exceeded or private-browsing restriction — ignore
  }
}

/**
 * Build a stable cache key from a URLSearchParams object.
 * Params are sorted so `a=1&b=2` and `b=2&a=1` produce the same key.
 */
export function cacheKey(params: URLSearchParams): string {
  const sorted = new URLSearchParams([...params.entries()].sort(([a], [b]) => a.localeCompare(b)))
  return sorted.toString()
}
