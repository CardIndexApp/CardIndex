/**
 * Supabase service-role (admin) client.
 *
 * IMPORTANT: Never import this in client components — it exposes the service
 * role key which bypasses all Row Level Security policies.
 * Only use in API routes and server actions.
 */
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase admin env vars missing')
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
