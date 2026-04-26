import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Pages that logged-in users should not see (pricing excluded so they can upgrade)
const AUTH_REDIRECT_PATHS = ['/']
// Pages that require login
const PROTECTED_PATHS = ['/dashboard', '/watchlist', '/account', '/admin', '/portfolio']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Logged-in users → send to dashboard instead of public pages
  if (user && AUTH_REDIRECT_PATHS.includes(path)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Unauthenticated users → send to home if they try protected pages
  if (!user && PROTECTED_PATHS.includes(path)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/img|api/).*)'],
}
