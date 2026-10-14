import type { SupabaseClient } from '@supabase/supabase-js';
import type { Booking, Parent, Session } from '@/lib/db/types';

/**
 * Free trial: accounts created after the feature launched
 * (`parents.free_trial_eligible`) get their first session free - one session,
 * one time. Older accounts never get it.
 *
 * Any booking that goes ahead, or is still in flight, uses the trial up. A
 * booking that never happened gives it back: an abandoned checkout, a
 * cancellation 24 hours or more ahead, a late booking declined by admin, or a
 * session we cancelled. A late cancellation uses it up, the same way a paid
 * session forfeits its credit.
 */

const LIVE_STATUSES = ['pending_payment', 'awaiting_approval', 'active'] as const;

export function bookingUsesTrial(
  b: Pick<Booking, 'status' | 'cancellation_outcome'>,
): boolean {
  if (b.status === 'abandoned') return false;
  if (b.status === 'cancelled') return b.cancellation_outcome === 'no_refund_late';
  return true;
}

export async function hasFreeTrial(
  supabase: SupabaseClient,
  parent: Pick<Parent, 'id' | 'free_trial_eligible'>,
): Promise<boolean> {
  if (!parent.free_trial_eligible) return false;
  const { data, error } = await supabase
    .from('bookings')
    .select('status, cancellation_outcome')
    .eq('parent_id', parent.id)
    .returns<Pick<Booking, 'status' | 'cancellation_outcome'>[]>();
  if (error) throw error;
  return !(data ?? []).some(bookingUsesTrial);
}

/** The trial goes on the earliest session in a checkout. -1 if there are none. */
export function trialIndex(sessions: Pick<Session, 'starts_at'>[]): number {
  let best = -1;
  sessions.forEach((s, i) => {
    if (best === -1 || s.starts_at < sessions[best].starts_at) best = i;
  });
  return best;
}

/**
 * Flags a just-reserved booking as the free trial. The reserve RPCs don't know
 * about trials, so this runs straight after them. If the flag can't be set
 * (another checkout claimed the trial a moment earlier), the booking is
 * abandoned rather than left as an unflagged free session.
 */
export async function markFreeTrialBooking(
  admin: SupabaseClient,
  b: { parentId: string; sessionId: string; childId: string },
): Promise<boolean> {
  const { data, error } = await admin
    .from('bookings')
    .update({ is_free_trial: true, payment_method: 'free', payment_note: 'Free trial' })
    .eq('parent_id', b.parentId)
    .eq('session_id', b.sessionId)
    .eq('child_id', b.childId)
    .in('status', LIVE_STATUSES)
    .select('id');

  if (!error && data && data.length > 0) return true;

  console.error('Free trial flag failed', error);
  await admin
    .from('bookings')
    .update({ status: 'abandoned' })
    .eq('parent_id', b.parentId)
    .eq('session_id', b.sessionId)
    .eq('child_id', b.childId)
    .in('status', LIVE_STATUSES);
  return false;
}
