import type { SupabaseClient } from '@supabase/supabase-js';
import { bookingNeedsApproval, sessionIsPast } from '@/lib/booking/rules';
import { sendWaitlistSpaceAvailable } from '@/lib/email/send';
import type { Child, Parent, Session, WaitlistEntry } from '@/lib/db/types';

const LIVE_STATUSES = ['pending_payment', 'awaiting_approval', 'active'];

type EntryWithJoins = WaitlistEntry & {
  parents: Pick<Parent, 'name' | 'email'> | null;
  children: Pick<Child, 'name'> | null;
};

export async function getRemainingSpaces(
  supabase: SupabaseClient,
  session: Pick<Session, 'id' | 'capacity'>,
): Promise<number> {
  const { data } = await supabase.rpc('get_session_availability', {
    p_session_ids: [session.id],
  });
  return (data as { session_id: string; remaining: number }[] | null)?.[0]?.remaining
    ?? session.capacity;
}

/**
 * Remove waiting-list entries for players who now hold a booking on that
 * session. Best effort - a stale entry is also filtered out at notify time.
 */
export async function clearWaitlistForBookings(
  supabase: SupabaseClient,
  bookings: { session_id: string; child_id: string | null }[],
): Promise<void> {
  for (const b of bookings) {
    if (!b.child_id) continue;
    const { error } = await supabase
      .from('waitlist_entries')
      .delete()
      .eq('session_id', b.session_id)
      .eq('child_id', b.child_id);
    if (error) console.error('Waitlist cleanup failed', error);
  }
}

/**
 * Call wherever a space might have opened up (cancellation, rejection,
 * abandoned checkout, capacity increase). If the session is open, in the
 * future and has room, everyone still waiting is emailed - first to book
 * gets the space. Never throws: the caller's action has already succeeded.
 */
export async function notifyWaitlist(supabase: SupabaseClient, sessionIds: string[]): Promise<void> {
  for (const sessionId of new Set(sessionIds)) {
    try {
      await notifyOne(supabase, sessionId);
    } catch (err) {
      console.error('Waitlist notify failed', sessionId, err);
    }
  }
}

async function notifyOne(supabase: SupabaseClient, sessionId: string) {
  const { data: entries } = await supabase
    .from('waitlist_entries')
    .select('*, parents(name, email), children(name)')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .returns<EntryWithJoins[]>();
  if (!entries || entries.length === 0) return;

  const { data: session } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle<Session>();
  if (!session || session.status !== 'open' || sessionIsPast(session)) return;
  if ((await getRemainingSpaces(supabase, session)) <= 0) return;

  // Skip (and tidy up) anyone who has since booked this session.
  const { data: live } = await supabase
    .from('bookings')
    .select('child_id')
    .eq('session_id', sessionId)
    .in('status', LIVE_STATUSES)
    .in('child_id', entries.map((e) => e.child_id));
  const booked = new Set((live ?? []).map((b) => b.child_id as string));
  if (booked.size > 0) {
    await clearWaitlistForBookings(
      supabase,
      [...booked].map((child_id) => ({ session_id: sessionId, child_id })),
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const needsApproval = bookingNeedsApproval(session);
  const notified: string[] = [];
  for (const e of entries) {
    if (booked.has(e.child_id) || !e.parents || !e.children) continue;
    try {
      await sendWaitlistSpaceAvailable({
        session,
        parent: e.parents,
        child: e.children,
        needsApproval,
        siteUrl,
      });
      notified.push(e.id);
    } catch (err) {
      console.error('Waitlist email failed', e.id, err);
    }
  }

  if (notified.length > 0) {
    await supabase
      .from('waitlist_entries')
      .update({ last_notified_at: new Date().toISOString() })
      .in('id', notified);
  }
}
