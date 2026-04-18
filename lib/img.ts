/**
 * Proxies pokemontcg.io image URLs through our own domain.
 * This avoids third-party image blocking by ad blockers, Brave, Firefox strict mode etc.
 */
export function tcgImg(url: string): string {
  if (!url) return ''
  return `/api/img?url=${encodeURIComponent(url)}`
}
