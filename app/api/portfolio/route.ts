/**
 * Portfolio API
 *
 * GET    /api/portfolio            — fetch user's positions
 * POST   /api/portfolio            — add a position
 * DELETE /api/portfolio?id=uuid    — remove a position
 * PATCH  /api/portfolio?id=uuid    — update quantity / purchase_price
 *
 * purchase_price is always stored in USD (client converts from local currency before POST/PATCH).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTierLimits } from '@/lib/tier'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('portfolios')
    .select('*')
    .eq('user_id', user.id)
    .order('added_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ positions: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Portfolio tracking is a Pro feature
  const { data: profile } = await supabase.from('profiles').select('tier').eq('id', user.id).single()
  if (!getTierLimits(profile?.tier).portfolioTracking) {
    return NextResponse.json({ error: 'Portfolio tracking requires a Pro plan.' }, { status: 403 })
  }

  const body = await req.json()
  const { card_id, card_name, set_name, grade, card_number, image_url, purchase_price, quantity, purchased_at, notes } = body

  if (!card_id || !card_name || !grade || purchase_price == null || !quantity) {
    return NextResponse.json({ error: 'card_id, card_name, grade, purchase_price and quantity are required' }, { status: 400 })
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
  if (notes != null && (typeof notes !== 'string' || notes.length > 2000))
    return NextResponse.json({ error: 'notes must be ≤2000 characters' }, { status: 400 })
  if (image_url != null) {
    try { const u = new URL(image_url); if (!['https:','http:'].includes(u.protocol)) throw new Error() }
    catch { return NextResponse.json({ error: 'image_url must be a valid URL' }, { status: 400 }) }
  }
  if (typeof purchase_price !== 'number' || purchase_price <= 0 || purchase_price > 10_000_000)
    return NextResponse.json({ error: 'purchase_price must be a positive number ≤10,000,000' }, { status: 400 })
  if (typeof quantity !== 'number' || quantity < 1 || quantity > 9999 || !Number.isInteger(quantity))
    return NextResponse.json({ error: 'quantity must be an integer between 1 and 9999' }, { status: 400 })

  const { data, error } = await supabase
    .from('portfolios')
    .insert({
      user_id: user.id,
      card_id,
      card_name,
      set_name: set_name || null,
      grade,
      card_number: card_number || null,
      image_url: image_url || null,
      purchase_price,
      quantity,
      purchased_at: purchased_at || null,
      notes: notes || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ position: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('portfolios')
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
  const updates: Record<string, unknown> = {}

  if (body.purchase_price != null) {
    if (typeof body.purchase_price !== 'number' || body.purchase_price <= 0 || body.purchase_price > 10_000_000)
      return NextResponse.json({ error: 'purchase_price must be a positive number ≤10,000,000' }, { status: 400 })
    updates.purchase_price = body.purchase_price
  }
  if (body.quantity != null) {
    if (typeof body.quantity !== 'number' || body.quantity < 1 || body.quantity > 9999 || !Number.isInteger(body.quantity))
      return NextResponse.json({ error: 'quantity must be an integer between 1 and 9999' }, { status: 400 })
    updates.quantity = body.quantity
  }
  if (body.notes != null) {
    if (typeof body.notes !== 'string' || body.notes.length > 2000)
      return NextResponse.json({ error: 'notes must be ≤2000 characters' }, { status: 400 })
    updates.notes = body.notes
  }
  if (body.purchased_at != null) updates.purchased_at = body.purchased_at

  const { data, error } = await supabase
    .from('portfolios')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ position: data })
}
