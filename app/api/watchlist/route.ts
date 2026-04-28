/**
 * Watchlist API
 *
 * GET    /api/watchlist          — fetch user's watchlist
 * POST   /api/watchlist          — add card to watchlist
 * DELETE /api/watchlist?id=uuid  — remove card from watchlist
 * PATCH  /api/watchlist?id=uuid  — update alert_price or notes
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTierLimits } from '@/lib/tier'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('watchlists')
    .select('*')
    .eq('user_id', user.id)
    .order('added_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { card_id, card_name, set_name, grade, image_url, alert_price, card_number } = body

  if (!card_id || !card_name || !grade) {
    return NextResponse.json({ error: 'card_id, card_name and grade are required' }, { status: 400 })
  }

  // ── Type & length validation ──────────────────────────────────────────────
  if (typeof card_id !== 'string' || card_id.length > 128)
    return NextResponse.json({ error: 'Invalid card_id' }, { status: 400 })
  if (typeof card_name !== 'string' || card_name.trim().length === 0 || card_name.length > 255)
    return NextResponse.json({ error: 'card_name must be 1–255 characters' }, { status: 400 })
  if (set_name != null && (typeof set_name !== 'string' || set_name.length > 255))
    return NextResponse.json({ error: 'set_name must be ≤255 characters' }, { status: 400 })
  if (typeof grade !== 'string' || grade.length > 64)
    return NextResponse.json({ error: 'Invalid grade' }, { status: 400 })
  if (alert_price != null && (typeof alert_price !== 'number' || alert_price <= 0 || alert_price > 10_000_000))
    return NextResponse.json({ error: 'alert_price must be a positive number ≤10,000,000' }, { status: 400 })
  if (image_url != null) {
    try { const u = new URL(image_url); if (!['https:','http:'].includes(u.protocol)) throw new Error() }
    catch { return NextResponse.json({ error: 'image_url must be a valid URL' }, { status: 400 }) }
  }

  // Tier-based limit check
  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', user.id)
    .single()

  const { count } = await supabase
    .from('watchlists')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const limit = getTierLimits(profile?.tier).watchlist
  if ((count ?? 0) >= limit) {
    return NextResponse.json(
      { error: 'Watchlist limit reached', tier: profile?.tier, limit },
      { status: 403 }
    )
  }

  const { data, error } = await supabase
    .from('watchlists')
    .upsert(
      { user_id: user.id, card_id, card_name, set_name, grade, image_url, alert_price, card_number: card_number || null },
      { onConflict: 'user_id,card_id,grade' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('watchlists')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const body = await req.json()
  const { alert_price, notes } = body

  if (alert_price != null && (typeof alert_price !== 'number' || alert_price <= 0 || alert_price > 10_000_000))
    return NextResponse.json({ error: 'alert_price must be a positive number ≤10,000,000' }, { status: 400 })
  if (notes != null && (typeof notes !== 'string' || notes.length > 2000))
    return NextResponse.json({ error: 'notes must be ≤2000 characters' }, { status: 400 })

  const { data, error } = await supabase
    .from('watchlists')
    .update({ alert_price, notes })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}
