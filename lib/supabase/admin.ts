import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client. Bypasses RLS - only use server-side in webhooks,
 * cron jobs, or admin-checked routes.
 */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
