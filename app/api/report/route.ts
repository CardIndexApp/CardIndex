/**
 * POST /api/report
 * Submit a card data issue report (price error, wrong card, other).
 * Saves to the card_reports table in Supabase.
 *
 * Required Supabase migration:
 *   create table card_reports (
 *     id          uuid primary key default gen_random_uuid(),
 *     card_id     text not null,
 *     card_name   text,
 *     grade       text,
 *     report_type text not null,   -- 'price_error' | 'wrong_card' | 'other'
 *     description text,
 *     page_url    text,
 *     user_id     uuid references auth.users(id),
 *     created_at  timestamptz default now()
 *   );
 *   alter table card_reports enable row level security;
 *   create policy "Anyone can insert reports" on card_reports for insert with check (true);
 *   create policy "Admins can read reports"   on card_reports for select using (
 *     exists (select 1 from profiles where id = auth.uid() and is_admin = true)
 *   );
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { notifyReport } from '@/lib/slack'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const VALID_TYPES = ['price_error', 'wrong_card', 'app_bug', 'data_issue', 'other'] as const
const RATE_LIMIT   = 5   // max reports
const WINDOW_MS    = 60 * 60 * 1000 // per hour

// Best-effort IP rate limit for anonymous requests (resets on cold start — acceptable)
const anonIpLog = new Map<string, number[]>()

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { card_id, card_name, grade, report_type, description, page_url } = body

    if (!card_id || !report_type) {
      return NextResponse.json({ error: 'card_id and report_type required' }, { status: 400 })
    }

    if (!VALID_TYPES.includes(report_type)) {
      return NextResponse.json({ error: 'Invalid report_type' }, { status: 400 })
    }

    if (description && description.length > 2000) {
      return NextResponse.json({ error: 'Description too long' }, { status: 400 })
    }

    // Get user id — Bearer token (iOS) or cookie session (web)
    let user_id: string | null = null
    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const { data } = await supabase.auth.getUser(token)
      user_id = data.user?.id ?? null
    } else {
      try {
        const userSupabase = await createUserClient()
        const { data: { user } } = await userSupabase.auth.getUser()
        user_id = user?.id ?? null
      } catch { /* anonymous */ }
    }

    const supabase = adminClient()
    const windowStart = new Date(Date.now() - WINDOW_MS).toISOString()

    if (user_id) {
      // Authenticated: count recent reports in Supabase
      const { count } = await supabase
        .from('card_reports')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user_id)
        .gte('created_at', windowStart)

      if ((count ?? 0) >= RATE_LIMIT) {
        return NextResponse.json(
          { error: 'Too many reports. Please wait before submitting again.' },
          { status: 429 }
        )
      }
    } else {
      // Anonymous: use in-memory IP log
      const ip  = getClientIp(req)
      const now = Date.now()
      const log = (anonIpLog.get(ip) ?? []).filter(t => now - t < WINDOW_MS)
      if (log.length >= RATE_LIMIT) {
        return NextResponse.json(
          { error: 'Too many reports. Please wait before submitting again.' },
          { status: 429 }
        )
      }
      log.push(now)
      anonIpLog.set(ip, log)
    }

    const { error } = await supabase.from('card_reports').insert({
      card_id,
      card_name:   card_name   ?? null,
      grade:       grade       ?? null,
      report_type,
      description: description ?? null,
      page_url:    page_url    ?? null,
      user_id,
    })

    if (error) {
      console.error('[report] insert failed:', error.message)
      return NextResponse.json({ error: 'Failed to save report' }, { status: 500 })
    }

    // Notify Slack (awaited so the serverless function doesn't exit early)
    await notifyReport({ card_id, card_name, grade, report_type, description, page_url })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
