import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import CardPageClient from './CardPageClient'

const SITE_URL = 'https://card-index.app'

// ── Types ──────────────────────────────────────────────────────────────────────
type Props = {
  params:       Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

// ── Helper: pull a single string from searchParams ────────────────────────────
function sp(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

// ── Lightweight cache lookup ──────────────────────────────────────────────────
interface CacheMeta {
  card_name: string | null
  set_name:  string | null
  grade:     string | null
  image_url: string | null
  price:     number | null
  score:     number | null
  price_change_pct: number | null
}

async function getCardMeta(id: string, grade: string): Promise<CacheMeta | null> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('search_cache')
      .select('card_name, set_name, grade, image_url, price, score, price_change_pct')
      .eq('cache_key', `${id}:${grade}`)
      .single()
    return data ?? null
  } catch {
    return null
  }
}

// ── generateMetadata ───────────────────────────────────────────────────────────
export async function generateMetadata(
  { params, searchParams }: Props,
): Promise<Metadata> {
  const { id }  = await params
  const raw     = await searchParams

  const urlName  = sp(raw.name)
  const urlGrade = sp(raw.grade) ?? 'PSA 10'
  const urlSet   = sp(raw.set)

  // Try to pull richer data from the cache
  const cached = await getCardMeta(id, urlGrade)

  const name  = urlName  ?? cached?.card_name ?? 'Trading Card'
  const grade = urlGrade ?? cached?.grade     ?? 'PSA 10'
  const set   = urlSet   ?? cached?.set_name  ?? null

  const price  = cached?.price  ?? null
  const change = cached?.price_change_pct ?? null
  const score  = cached?.score  ?? null
  const img    = cached?.image_url ?? null

  // ── Title & Description ──────────────────────────────────────────────────────
  const priceStr  = price  != null ? ` · $${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''
  const changeStr = change != null ? ` (${change >= 0 ? '+' : ''}${change.toFixed(1)}% 30d)` : ''
  const scoreStr  = score  != null ? ` · Score ${score}/100` : ''

  const title       = `${name} ${grade} Price${priceStr} — CardIndex`
  const description = [
    `Live market price`,
    set ? `for ${name} ${grade} from ${set}` : `for ${name} ${grade}`,
    priceStr  ? `Current: $${price!.toLocaleString()}${changeStr}.` : null,
    scoreStr  ? `CardIndex Score: ${score}/100.` : null,
    `Updated daily from real eBay sold listings.`,
  ].filter(Boolean).join(' ')

  // ── Canonical URL ─────────────────────────────────────────────────────────────
  const canonicalParams = new URLSearchParams({ grade, name })
  if (set) canonicalParams.set('set', set)
  const canonical = `${SITE_URL}/card/${id}?${canonicalParams.toString()}`

  // ── OG image list ─────────────────────────────────────────────────────────────
  const images = img
    ? [{ url: img, width: 245, height: 342, alt: `${name} ${grade}` }]
    : [{ url: `${SITE_URL}/icon-512.png`, width: 512, height: 512, alt: 'CardIndex' }]

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'CardIndex',
      images,
      type: 'website',
    },
    twitter: {
      card: img ? 'summary_large_image' : 'summary',
      title,
      description,
      images: images.map(i => i.url),
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

// ── JSON-LD structured data ───────────────────────────────────────────────────
async function CardJsonLd({ id, searchParams }: { id: string; searchParams: Record<string, string | string[] | undefined> }) {
  const urlName  = sp(searchParams.name)
  const urlGrade = sp(searchParams.grade) ?? 'PSA 10'
  const urlSet   = sp(searchParams.set)

  const cached = await getCardMeta(id, urlGrade)

  const name  = urlName  ?? cached?.card_name ?? 'Trading Card'
  const grade = urlGrade
  const set   = urlSet   ?? cached?.set_name  ?? null
  const price = cached?.price ?? null
  const img   = cached?.image_url ?? null

  const canonical = `${SITE_URL}/card/${id}?${new URLSearchParams({ grade, name, ...(set ? { set } : {}) })}`

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${name} ${grade}`,
    description: `${grade} graded ${name}${set ? ` from ${set}` : ''} — market price and analysis on CardIndex`,
    url: canonical,
    brand: { '@type': 'Brand', name: 'Pokémon TCG' },
    ...(img ? { image: img } : {}),
    ...(price != null
      ? {
          offers: {
            '@type': 'Offer',
            priceCurrency: 'USD',
            price: price.toFixed(2),
            availability: 'https://schema.org/InStock',
            url: canonical,
          },
        }
      : {}),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function CardPage({ params, searchParams }: Props) {
  const { id } = await params
  const raw    = await searchParams

  return (
    <>
      <CardJsonLd id={id} searchParams={raw} />
      <CardPageClient />
    </>
  )
}
