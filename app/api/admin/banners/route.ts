/**
 * GET    /api/admin/banners  — list all banners
 * POST   /api/admin/banners  — create a new banner (deactivates any existing active one first)
 * PATCH  /api/admin/banners  — toggle active { id, active }
 * DELETE /api/admin/banners  — delete { id }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function getCallerId(req: NextRequest): Promise<string | null> {
  const supabase = adminClient()
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const { data } = await supabase.auth.getUser(authHeader.slice(7))
    return data.user?.id ?? null
  }
  // Cookie-based (web)
  const { createClient: createUserClient } = await import('@/lib/supabase/server')
  try {
    const uc = await createUserClient()
    const { data: { user } } = await uc.auth.getUser()
    return user?.id ?? null
  } catch { return null }
}

async function requireAdmin(req: NextRequest) {
  const supabase = adminClient()
  const callerId = await getCallerId(req)
  if (!callerId) return null
  const { data } = await supabase.from('profiles').select('is_admin').eq('id', callerId).single()
  return data?.is_admin ? callerId : null
}

export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const supabase = adminClient()
  const { data } = await supabase
    .from('app_banners')
    .select('*')
    .order('created_at', { ascending: false })
  return NextResponse.json({ banners: data ?? [] })
}

export async function POST(req: NextRequest) {
  const callerId = await requireAdmin(req)
  if (!callerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { title, body, cta_label, cta_url } = await req.json()
  if (!title?.trim() || !body?.trim()) {
    return NextResponse.json({ error: 'title and body required' }, { status: 400 })
  }

  const supabase = adminClient()

  // Deactivate any existing active banner (only one active at a time)
  await supabase.from('app_banners').update({ active: false }).eq('active', true)

  const { data, error } = await supabase
    .from('app_banners')
    .insert({
      title: title.trim(),
      body: body.trim(),
      cta_label: cta_label?.trim() || null,
      cta_url: cta_url?.trim() || null,
      active: true,
      created_by: callerId,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ banner: data })
}

export async function PATCH(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, active } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const supabase = adminClient()

  // If activating, deactivate all others first
  if (active) await supabase.from('app_banners').update({ active: false }).eq('active', true)

  const { error } = await supabase.from('app_banners').update({ active }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const supabase = adminClient()
  const { error } = await supabase.from('app_banners').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
