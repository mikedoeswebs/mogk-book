import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Parent } from '@/lib/db/types';
import { requireUser } from './require-user';

/**
 * Ensures the current user has both an auth session AND a row in the parents
 * table. New users are redirected to /onboarding to finish registration.
 */
export async function requireParent(): Promise<Parent> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data: parent } = await supabase
    .from('parents')
    .select('*')
    .eq('id', user.id)
    .maybeSingle<Parent>();

  if (!parent) redirect('/onboarding');

  // Sync parents.email from auth after the user confirms an email change.
  if (user.email && user.email.toLowerCase() !== parent.email.toLowerCase()) {
    await supabase.from('parents').update({ email: user.email }).eq('id', parent.id);
    parent.email = user.email;
  }

  return parent;
}
