// POST /api/packs/cards — add a card to a pack
// DELETE /api/packs/cards?id=xxx — remove a card from a pack

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const admin = createAdminClient()
  const body = await req.json()
  const { data, error } = await admin.from('pack_cards').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ card: data })
}

export async function DELETE(req: Request) {
  const admin = createAdminClient()
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await admin.from('pack_cards').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
