/**
 * Cache management API (authenticated users only)
 *
 * DELETE /api/cache?id={pokemontcg_id}            — purge all grades for a card
 * DELETE /api/cache?id={pokemontcg_id}&grade=PSA+10 — purge one specific entry
 * DELETE /api/cache?all=1                          — purge entire cache (is_admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(req: NextRequest) {
  // Must be logged in
  const userSupabase = await createUserClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id    = req.nextUrl.searchParams.get('id')
  const grade = req.nextUrl.searchParams.get('grade')
  const all   = req.nextUrl.searchParams.get('all') === '1'

  const supabase = createAdminClient()

  if (all) {
    // Requires is_admin flag — tier alone is never sufficient for global destructive operations
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { error } = await supabase.from('search_cache').delete().neq('cache_key', '')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, purged: 'all' })
  }

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Validate id format to prevent wildcard injection via LIKE pattern
  // pokemontcg IDs look like "sv4-1" or "base1-4"; Poketrace UUIDs are hex+dashes
  const safeId = id.replace(/[%_]/g, '')  // strip SQL LIKE wildcards before embedding in pattern
  if (safeId !== id) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  let query = supabase.from('search_cache').delete()

  if (grade) {
    // Purge one specific cache_key — exact match, no pattern
    query = query.eq('cache_key', `${id}:${grade}`)
  } else {
    // Purge all grades for this card
    query = query.like('cache_key', `${id}:%`)
  }

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, purged: grade ? `${id}:${grade}` : `${id}:*` })
}
