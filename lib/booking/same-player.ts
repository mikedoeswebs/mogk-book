import type { SupabaseClient } from '@supabase/supabase-js';

const LIVE_STATUSES = ['pending_payment', 'awaiting_approval', 'active'];

/**
 * Which of `childIds` are already booked on which of `sessionIds`, as
 * `${sessionId}:${childId}` keys. Counts bookings made under any record of
 * the same player (children.same_as), so a player registered by two parents
 * can't be booked twice. Needs the service role: the other parent's records
 * and bookings are hidden by RLS.
 */
export async function bookedPlayerKeys(
  admin: SupabaseClient,
  childIds: string[],
  sessionIds: string[],
): Promise<Set<string>> {
  if (childIds.length === 0 || sessionIds.length === 0) return new Set();
  type Row = { id: string; same_as: string | null };
  const playerOf = (c: Row) => c.same_as ?? c.id;

  const mine = await admin.from('children').select('id, same_as').in('id', childIds).returns<Row[]>();
  if (mine.error) throw mine.error;
  const players = [...new Set(mine.data.map(playerOf))].join(',');

  const records = await admin
    .from('children')
    .select('id, same_as')
    .or(`id.in.(${players}),same_as.in.(${players})`)
    .returns<Row[]>();
  if (records.error) throw records.error;
  const playerById = new Map(records.data.map((r) => [r.id, playerOf(r)]));

  const booked = await admin
    .from('bookings')
    .select('session_id, child_id')
    .in('session_id', sessionIds)
    .in('child_id', [...playerById.keys()])
    .in('status', LIVE_STATUSES)
    .returns<{ session_id: string; child_id: string }[]>();
  if (booked.error) throw booked.error;
  const bookedPlayers = new Set(booked.data.map((b) => `${b.session_id}:${playerById.get(b.child_id)}`));

  const keys = new Set<string>();
  for (const c of mine.data) {
    for (const s of sessionIds) {
      if (bookedPlayers.has(`${s}:${playerOf(c)}`)) keys.add(`${s}:${c.id}`);
    }
  }
  return keys;
}
