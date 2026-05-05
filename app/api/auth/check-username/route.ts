import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username')?.trim().toLowerCase()
  if (!username || username.length < 3) {
    return NextResponse.json({ available: false, error: 'Too short' })
  }

  const { data } = await admin()
    .from('profiles')
    .select('id')
    .ilike('username', username)
    .maybeSingle()

  return NextResponse.json({ available: !data })
}
