'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { clearWaitlistForBookings, notifyWaitlist } from '@/lib/booking/waitlist';

const ALLOWED_METHODS = new Set([
  'card',
  'cash',
  'cheque',
  'bank_transfer',
  'free',
  'credit',
  'other',
]);

export async function updateAdminBooking(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get('id') ?? '').trim();
  const amountPounds = Number(formData.get('amount') ?? '0');
  const paymentMethod = String(formData.get('payment_method') ?? '').trim();
  const paymentNote = String(formData.get('payment_note') ?? '').trim() || null;
  const trialistNameRaw = formData.get('trialist_name');
  const trialistName = trialistNameRaw === null ? null : String(trialistNameRaw).trim();

  if (!id) redirect('/admin/bookings?error=Missing+booking+id');
  if (!Number.isFinite(amountPounds) || amountPounds < 0) {
    redirect(`/admin/bookings/${id}/edit?error=${encodeURIComponent('Invalid amount')}`);
  }
  if (!ALLOWED_METHODS.has(paymentMethod)) {
    redirect(`/admin/bookings/${id}/edit?error=${encodeURIComponent('Invalid payment method')}`);
  }

  const admin = createSupabaseAdminClient();

  const { data: existing, error: fetchError } = await admin
    .from('bookings')
    .select('is_ghost')
    .eq('id', id)
    .maybeSingle<{ is_ghost: boolean }>();

  if (fetchError || !existing) {
    redirect(`/admin/bookings/${id}/edit?error=${encodeURIComponent(fetchError?.message ?? 'Booking not found')}`);
  }

  if (existing.is_ghost && !trialistName) {
    redirect(`/admin/bookings/${id}/edit?error=${encodeURIComponent('Player name is required')}`);
  }

  const update: {
    amount_pence: number;
    payment_method: string;
    payment_note: string | null;
    trialist_name?: string;
  } = {
    amount_pence: Math.round(amountPounds * 100),
    payment_method: paymentMethod,
    payment_note: paymentNote,
  };

  if (existing.is_ghost && trialistName) {
    update.trialist_name = trialistName;
  }

  const { error } = await admin
    .from('bookings')
    .update(update)
    .eq('id', id);

  if (error) {
    redirect(`/admin/bookings/${id}/edit?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/admin/bookings');
  redirect('/admin/bookings?success=Booking+updated');
}

// Moves a booking to another session. Money is deliberately untouched: no
// credit, refund or price change, only which session the place counts against.
export async function moveAdminBooking(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get('id') ?? '').trim();
  const sessionId = String(formData.get('session_id') ?? '').trim();

  if (!id) redirect('/admin/bookings?error=Missing+booking+id');
  if (!sessionId) {
    redirect(`/admin/bookings/${id}/edit?error=${encodeURIComponent('Choose a session')}`);
  }

  const admin = createSupabaseAdminClient();

  const { data: oldSessionId, error } = await admin.rpc('admin_move_booking', {
    p_booking_id: id,
    p_session_id: sessionId,
  });

  if (error) {
    redirect(`/admin/bookings/${id}/edit?error=${encodeURIComponent(humaniseMoveError(error.message))}`);
  }

  const { data: moved } = await admin
    .from('bookings')
    .select('child_id')
    .eq('id', id)
    .maybeSingle<{ child_id: string | null }>();
  if (moved?.child_id) {
    await clearWaitlistForBookings(admin, [{ session_id: sessionId, child_id: moved.child_id }]);
  }
  await notifyWaitlist(admin, [oldSessionId as string]);

  revalidatePath('/admin/bookings');
  redirect('/admin/bookings?success=Booking+moved');
}

function humaniseMoveError(raw: string): string {
  if (raw.includes('session_full')) return 'That session is full.';
  if (raw.includes('session_closed')) return 'That session is cancelled.';
  if (raw.includes('session_not_found')) return 'Session not found.';
  if (raw.includes('same_session')) return 'The booking is already in that session.';
  if (raw.includes('already_booked')) return 'This player is already booked into that session.';
  if (raw.includes('booking_not_movable')) return 'Only active or awaiting-approval bookings can be moved.';
  if (raw.includes('booking_not_found')) return 'Booking not found.';
  return raw;
}
