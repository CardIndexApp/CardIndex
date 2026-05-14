// GET /api/packs — returns all active packs with their cards + current prices from search_cache
// POST /api/packs — admin: create a pack
// DELETE /api/packs?id=xxx — admin: delete a pack

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const admin = createAdminClient()
  const { data: packs } = await admin.from('packs').select('*').eq('is_active', true).order('release_date', { ascending: false })
  if (!packs?.length) return NextResponse.json({ packs: [] })

  // For each pack, get its cards + join prices from search_cache
  const results = await Promise.all(packs.map(async (pack) => {
    const { data: cards } = await admin.from('pack_cards').select('*').eq('pack_id', pack.id)
    if (!cards?.length) return { ...pack, cards: [], ev_usd: 0 }

    // Get prices for cards that have a card_id
    const cardIds = cards.filter(c => c.card_id).map(c => c.card_id)
    const priceMap = new Map<string, number>()
    if (cardIds.length) {
      const { data: cached } = await admin.from('search_cache')
        .select('card_id, price, grade')
        .in('card_id', cardIds)
        .eq('grade', 'Raw')
      for (const row of cached ?? []) {
        if (row.price) priceMap.set(row.card_id, row.price)
      }
    }

    // Calculate EV
    let ev_usd = 0
    const enrichedCards = cards.map(c => {
      const price = c.card_id ? (priceMap.get(c.card_id) ?? 0) : 0
      const contribution = price * (c.pull_rate_pct / 100)
      ev_usd += contribution
      return { ...c, price, contribution }
    })

    return { ...pack, cards: enrichedCards, ev_usd: Math.round(ev_usd * 100) / 100 }
  }))

  return NextResponse.json({ packs: results })
}

export async function POST(req: Request) {
  const admin = createAdminClient()
  const body = await req.json()
  const { data, error } = await admin.from('packs').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ pack: data })
}

export async function DELETE(req: Request) {
  const admin = createAdminClient()
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await admin.from('packs').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
