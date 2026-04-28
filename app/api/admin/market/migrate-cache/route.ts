/**
 * POST /api/admin/market/migrate-cache
 *
 * Returns the SQL needed to add any missing columns to search_cache.
 * Run the returned SQL in your Supabase SQL editor (Dashboard → SQL editor).
 *
 * Safe to re-run — uses ADD COLUMN IF NOT EXISTS throughout.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: p } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  return p?.is_admin ? admin : null
}

const MIGRATION_SQL = `
-- Run this in your Supabase SQL editor to add missing columns to search_cache
ALTER TABLE search_cache ADD COLUMN IF NOT EXISTS match_reason text;
ALTER TABLE search_cache ADD COLUMN IF NOT EXISTS resolved_tier text;
ALTER TABLE search_cache ADD COLUMN IF NOT EXISTS confidence text;
ALTER TABLE search_cache ADD COLUMN IF NOT EXISTS data_warning text;
ALTER TABLE search_cache ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'ebay';
ALTER TABLE search_cache ADD COLUMN IF NOT EXISTS ebay_sale_count integer;
ALTER TABLE search_cache ADD COLUMN IF NOT EXISTS ebay_avg_usd numeric;
ALTER TABLE search_cache ADD COLUMN IF NOT EXISTS avg1d numeric;
ALTER TABLE search_cache ADD COLUMN IF NOT EXISTS avg7d numeric;
ALTER TABLE search_cache ADD COLUMN IF NOT EXISTS avg30d numeric;
ALTER TABLE search_cache ADD COLUMN IF NOT EXISTS trend text;
ALTER TABLE search_cache ADD COLUMN IF NOT EXISTS all_tier_prices jsonb;
ALTER TABLE search_cache ADD COLUMN IF NOT EXISTS total_sale_count integer;
ALTER TABLE search_cache ADD COLUMN IF NOT EXISTS last_updated_pt text;
ALTER TABLE search_cache ADD COLUMN IF NOT EXISTS poketrace_id text;
ALTER TABLE search_cache ADD COLUMN IF NOT EXISTS currency text;
ALTER TABLE search_cache ADD COLUMN IF NOT EXISTS market text;
ALTER TABLE search_cache ADD COLUMN IF NOT EXISTS score_breakdown jsonb;
ALTER TABLE search_cache ADD COLUMN IF NOT EXISTS price_range_low numeric;
ALTER TABLE search_cache ADD COLUMN IF NOT EXISTS price_range_high numeric;
`.trim()

export async function POST() {
  const admin = await verifyAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Try to run via Supabase's pg_net / pg extension if exec_sql RPC exists
  const { error: rpcError } = await admin.rpc('exec_sql', { sql: MIGRATION_SQL })

  if (rpcError) {
    // exec_sql not available (common) — return SQL for manual execution
    return NextResponse.json({
      message: 'Run the SQL below in your Supabase SQL editor (Dashboard → SQL editor → New query)',
      sql: MIGRATION_SQL,
    })
  }

  return NextResponse.json({ ok: true, message: 'Migration applied successfully' })
}
