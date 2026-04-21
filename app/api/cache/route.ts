/**
 * Cache management API (authenticated users only)
 *
 * DELETE /api/cache?id={pokemontcg_id}            — purge all grades for a card
 * DELETE /api/cache?id={pokemontcg_id}&grade=PSA+10 — purge one specific entry
 * DELETE /api/cache?all=1                          — purge your entire cache (admin-only flag)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function DELETE(req: NextRequest) {
  // Must be logged in
  const userSupabase = await createUserClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id    = req.nextUrl.searchParams.get('id')
  const grade = req.nextUrl.searchParams.get('grade')
  const all   = req.nextUrl.searchParams.get('all') === '1'

  const supabase = adminClient()

  if (all) {
    // Safety: only allow if user is an admin (tier = 'pro' or specific email)
    const { data: profile } = await userSupabase.from('profiles').select('tier').eq('id', user.id).single()
    if (profile?.tier !== 'pro') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }
    const { error } = await supabase.from('search_cache').delete().neq('cache_key', '')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, purged: 'all' })
  }

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  let query = supabase.from('search_cache').delete()

  if (grade) {
    // Purge one specific cache_key
    query = query.eq('cache_key', `${id}:${grade}`)
  } else {
    // Purge all grades for this card
    query = query.like('cache_key', `${id}:%`)
  }

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, purged: grade ? `${id}:${grade}` : `${id}:*` })
}
