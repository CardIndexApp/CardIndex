import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifyNewUser } from '@/lib/slack'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Notify Slack if this is a brand-new account (created within last 60s)
      const user = data?.user
      if (user?.created_at) {
        const ageMs = Date.now() - new Date(user.created_at).getTime()
        if (ageMs < 60_000) {
          const provider = user.app_metadata?.provider ?? 'email'
          notifyNewUser({ email: user.email ?? 'unknown', provider, createdAt: user.created_at })
        }
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth_callback_failed`)
}
