/**
 * /api/admin/market/constituents
 *
 * GET    — list all CI-100 constituents joined with latest search_cache data
 * POST   — add a card to the index  { card_id, grade, card_name, set_name, image_url }
 * DELETE ?id=uuid — remove a constituent
 *
 * All methods require is_admin = true.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function verifyAdmin(): Promise<{ ok: true; admin: ReturnType<typeof createAdminClient> } | { ok: false; res: ReturnType<typeof NextResponse.json> }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const admin = createAdminClient()
  const { data: caller } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!caller?.is_admin) return { ok: false, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

  return { ok: true, admin }
}

export async function GET() {
  const check = await verifyAdmin()
  if (!check.ok) return check.res
  const { admin } = check

  // Fetch all constituents
  const { data: constituents, error } = await admin
    .from('market_constituents')
    .select('*')
    .order('card_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!constituents?.length) return NextResponse.json({ constituents: [] })

  // Cross-reference with search_cache for latest price data
  const cacheKeys = constituents.map(c => `${c.card_id}:${c.grade}`)
  const { data: cached } = await admin
    .from('search_cache')
    .select('cache_key, price, price_change_pct, last_fetched, avg7d, avg30d')
    .in('cache_key', cacheKeys)

  const cacheMap = new Map((cached ?? []).map(r => [r.cache_key, r]))

  const enriched = constituents.map(c => {
    const hit = cacheMap.get(`${c.card_id}:${c.grade}`)
    return {
      ...c,
      price: hit?.price ?? null,
      price_change_pct: hit?.price_change_pct ?? null,
      last_fetched: hit?.last_fetched ?? null,
      avg7d: hit?.avg7d ?? null,
    }
  })

  return NextResponse.json({ constituents: enriched })
}

export async function POST(req: NextRequest) {
  const check = await verifyAdmin()
  if (!check.ok) return check.res
  const { admin } = check

  const body = await req.json()
  const { card_id, grade, card_name, set_name, image_url } = body

  if (!card_id || !grade || !card_name)
    return NextResponse.json({ error: 'card_id, grade and card_name are required' }, { status: 400 })
  if (typeof card_id !== 'string' || card_id.length > 128)
    return NextResponse.json({ error: 'Invalid card_id' }, { status: 400 })
  if (typeof grade !== 'string' || grade.length > 64)
    return NextResponse.json({ error: 'Invalid grade' }, { status: 400 })
  if (typeof card_name !== 'string' || card_name.length > 255)
    return NextResponse.json({ error: 'Invalid card_name' }, { status: 400 })

  // Check index size cap (200 max to keep index meaningful)
  const { count } = await admin
    .from('market_constituents')
    .select('*', { count: 'exact', head: true })
  if ((count ?? 0) >= 200)
    return NextResponse.json({ error: 'Index limit of 200 cards reached' }, { status: 400 })

  const { data, error } = await admin
    .from('market_constituents')
    .upsert({ card_id, grade, card_name, set_name: set_name || null, image_url: image_url || null },
      { onConflict: 'card_id,grade' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ constituent: data })
}

export async function DELETE(req: NextRequest) {
  const check = await verifyAdmin()
  if (!check.ok) return check.res
  const { admin } = check

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await admin
    .from('market_constituents')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
