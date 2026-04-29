import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

const SITE_URL = 'https://card-index.app'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ── Static routes ────────────────────────────────────────────────────────────
  const static_routes: MetadataRoute.Sitemap = [
    { url: SITE_URL,             lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
    { url: `${SITE_URL}/market`, lastModified: new Date(), changeFrequency: 'hourly',  priority: 0.9 },
    { url: `${SITE_URL}/search`, lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${SITE_URL}/pricing`,lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
  ]

  // ── Popular card pages from cache ─────────────────────────────────────────────
  // Pull the 200 most recently fetched cached cards — these are the ones people
  // are actively looking at, so they're the best candidates for indexing.
  let card_routes: MetadataRoute.Sitemap = []
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('search_cache')
      .select('card_id, card_name, set_name, grade, last_fetched')
      .order('last_fetched', { ascending: false })
      .limit(200)

    if (data) {
      card_routes = data.map(row => {
        const params = new URLSearchParams({ grade: row.grade, name: row.card_name })
        if (row.set_name) params.set('set', row.set_name)
        return {
          url: `${SITE_URL}/card/${row.card_id}?${params.toString()}`,
          lastModified: new Date(row.last_fetched),
          changeFrequency: 'daily' as const,
          priority: 0.7,
        }
      })
    }
  } catch {
    // Non-fatal — sitemap still works without card routes
  }

  return [...static_routes, ...card_routes]
}
