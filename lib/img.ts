/**
 * Proxies card image URLs through our own /api/img route.
 * Handles both pokemontcg.io and cdn.poketrace.com (API key added server-side).
 * Avoids third-party image blocking by ad blockers, Brave, Firefox strict mode etc.
 */
export function tcgImg(url: string): string {
  if (!url) return ''
  return `/api/img?url=${encodeURIComponent(url)}`
}

/** Alias for Poketrace CDN images — routes through the same proxy with API key. */
export const ptImg = tcgImg
