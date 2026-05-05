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
      // Notify Slack for new Google/OAuth signups.
      // A new user has created_at === last_sign_in_at (first ever sign-in).
      const user = data?.user
      if (user?.created_at && user?.last_sign_in_at) {
        const createdAt     = new Date(user.created_at).getTime()
        const lastSignIn    = new Date(user.last_sign_in_at).getTime()
        const isNewUser     = Math.abs(createdAt - lastSignIn) < 5_000 // within 5s → first login
        const provider      = user.app_metadata?.provider ?? 'unknown'
        const isOAuth       = provider !== 'email'
        if (isNewUser && isOAuth) {
          notifyNewUser({ email: user.email ?? 'unknown', provider, createdAt: user.created_at })
        }
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth_callback_failed`)
}
