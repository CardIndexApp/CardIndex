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

  const body = await req.json()
  const { card_id, card_name, set_name, grade, card_number, image_url, purchase_price, quantity, purchased_at, notes } = body

  if (!card_id || !card_name || !grade || purchase_price == null || !quantity) {
    return NextResponse.json({ error: 'card_id, card_name, grade, purchase_price and quantity are required' }, { status: 400 })
  }
  if (typeof purchase_price !== 'number' || purchase_price <= 0) {
    return NextResponse.json({ error: 'purchase_price must be a positive number' }, { status: 400 })
  }
  if (typeof quantity !== 'number' || quantity < 1 || !Number.isInteger(quantity)) {
    return NextResponse.json({ error: 'quantity must be a positive integer' }, { status: 400 })
  }

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
  if (body.purchase_price != null) updates.purchase_price = body.purchase_price
  if (body.quantity != null)       updates.quantity = body.quantity
  if (body.notes != null)          updates.notes = body.notes
  if (body.purchased_at != null)   updates.purchased_at = body.purchased_at

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
