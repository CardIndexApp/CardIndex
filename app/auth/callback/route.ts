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
      // Detect new user: created_at within last 2 minutes
      const user = data?.user
      if (user?.created_at) {
        const ageMs   = Date.now() - new Date(user.created_at).getTime()
        const provider = user.app_metadata?.provider ?? 'email'
        if (ageMs < 120_000) {
          console.log(`[auth/callback] new user detected (${provider}, age ${ageMs}ms) — notifying Slack`)
          await notifyNewUser({ email: user.email ?? 'unknown', provider, createdAt: user.created_at })
        }
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth_callback_failed`)
}
