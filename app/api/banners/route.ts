/**
 * GET /api/banners
 * Returns the single active app banner, or null if none.
 * Public — no auth required.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from('app_banners')
    .select('id, title, body, cta_label, cta_url, created_at')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ banner: null })
  return NextResponse.json({ banner: data })
}
