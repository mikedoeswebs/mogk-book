import type { SupabaseClient } from '@supabase/supabase-js';

export type LapsedPlayer = {
  child_id: string;
  child_name: string;
  parent_id: string;
  parent_name: string;
  parent_email: string;
  parent_phone: string | null;
  session_dates: string[];
  last_date: string;
  days_since: number;
};

export type LapsedOptions = {
  /** Only include players whose first session was within this many months. */
  months: number;
  /** Players with at most this many sessions count as lapsed. */
  maxSessions: number;
  /** Ignore players whose last session was more recent than this. */
  minWeeksSince: number;
};

type BookingRow = {
  child_id: string;
  status: string;
  attended: boolean | null;
  sessions: { date: string } | null;
  children: {
    id: string;
    name: string;
    parents: { id: string; name: string; email: string; phone: string | null } | null;
  } | null;
};

const PAGE_SIZE = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Real (non-ghost) players who came to a handful of sessions recently and
 * haven't been back or booked again since. A session counts if the booking is
 * active and the register doesn't mark them as missed.
 */
export async function getLapsedPlayers(
  supabase: SupabaseClient,
  opts: LapsedOptions,
  now = new Date(),
): Promise<LapsedPlayer[]> {
  const today = now.toISOString().slice(0, 10);
  const windowStart = new Date(now);
  windowStart.setMonth(windowStart.getMonth() - opts.months);
  const windowStartIso = windowStart.toISOString().slice(0, 10);
  const cutoffIso = new Date(now.getTime() - opts.minWeeksSince * 7 * DAY_MS)
    .toISOString()
    .slice(0, 10);

  // Every live booking for a real player, paged past Supabase's 1000-row cap.
  const rows: BookingRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('bookings')
      .select(
        'child_id, status, attended, sessions!session_id(date), children(id, name, parents(id, name, email, phone))',
      )
      .eq('is_ghost', false)
      .not('child_id', 'is', null)
      .in('status', ['active', 'awaiting_approval', 'pending_payment'])
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
      .returns<BookingRow[]>();
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }

  type Acc = { row: BookingRow; past: string[]; hasUpcoming: boolean };
  const byChild = new Map<string, Acc>();
  for (const r of rows) {
    if (!r.sessions || !r.children?.parents) continue;
    const acc = byChild.get(r.child_id) ?? { row: r, past: [], hasUpcoming: false };
    if (r.sessions.date >= today) {
      acc.hasUpcoming = true;
    } else if (r.status === 'active' && r.attended !== false) {
      acc.past.push(r.sessions.date);
    }
    byChild.set(r.child_id, acc);
  }

  const result: LapsedPlayer[] = [];
  for (const [childId, acc] of byChild) {
    if (acc.hasUpcoming) continue;
    if (acc.past.length === 0 || acc.past.length > opts.maxSessions) continue;
    const dates = [...new Set(acc.past)].sort();
    const first = dates[0];
    const last = dates[dates.length - 1];
    if (first < windowStartIso || last > cutoffIso) continue;

    const parent = acc.row.children!.parents!;
    result.push({
      child_id: childId,
      child_name: acc.row.children!.name,
      parent_id: parent.id,
      parent_name: parent.name,
      parent_email: parent.email,
      parent_phone: parent.phone,
      session_dates: dates,
      last_date: last,
      days_since: Math.floor((now.getTime() - new Date(last + 'T00:00:00').getTime()) / DAY_MS),
    });
  }

  // Most recently lapsed first - the warmest leads.
  return result.sort((a, b) => a.days_since - b.days_since);
}
