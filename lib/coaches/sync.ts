import type { SupabaseClient } from '@supabase/supabase-js';
import type { Coach } from '@/lib/db/types';

/**
 * Reconcile the coach list attached to a session.
 *
 * - Inserts any coach_ids in `newCoachIds` that aren't already linked.
 * - Removes any current links not in the new set (preserving `attended` on
 *   links that stay).
 * - Rewrites `sessions.coach_name` to the comma-joined names of the new set,
 *   so the rest of the app (list views, emails, CSV export) keeps reading the
 *   denormalised field without needing to know about the join.
 *
 * Use this from session create/edit server actions after you've inserted /
 * updated the sessions row.
 */
export async function reconcileSessionCoaches(
  admin: SupabaseClient,
  sessionId: string,
  newCoachIds: string[],
): Promise<void> {
  if (newCoachIds.length === 0) {
    throw new Error('A session needs at least one coach.');
  }

  const { data: existing, error: existErr } = await admin
    .from('session_coaches')
    .select('coach_id')
    .eq('session_id', sessionId)
    .returns<{ coach_id: string }[]>();
  if (existErr) throw existErr;

  const existingSet = new Set((existing ?? []).map((r) => r.coach_id));
  const wantedSet = new Set(newCoachIds);

  const toAdd = newCoachIds.filter((id) => !existingSet.has(id));
  const toRemove = [...existingSet].filter((id) => !wantedSet.has(id));

  if (toRemove.length > 0) {
    const { error } = await admin
      .from('session_coaches')
      .delete()
      .eq('session_id', sessionId)
      .in('coach_id', toRemove);
    if (error) throw error;
  }

  if (toAdd.length > 0) {
    const { error } = await admin
      .from('session_coaches')
      .insert(toAdd.map((coach_id) => ({ session_id: sessionId, coach_id })));
    if (error) throw error;
  }

  // Refresh sessions.coach_name from the join (sorted by name for stability).
  const { data: linked, error: linkedErr } = await admin
    .from('coaches')
    .select('name')
    .in('id', newCoachIds)
    .order('name', { ascending: true })
    .returns<Pick<Coach, 'name'>[]>();
  if (linkedErr) throw linkedErr;

  const coachName = (linked ?? []).map((c) => c.name).join(', ');
  const { error: updateErr } = await admin
    .from('sessions')
    .update({ coach_name: coachName })
    .eq('id', sessionId);
  if (updateErr) throw updateErr;
}
