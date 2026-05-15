'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendBookingConfirmation } from '@/lib/email/send';
import type { Booking, Child, Parent, Session } from '@/lib/db/types';

export async function createAdminBooking(formData: FormData) {
  await requireAdmin();

  const isGhost = String(formData.get('is_ghost') ?? '0') === '1';
  const sessionId = String(formData.get('session_id') ?? '').trim();
  const childId = String(formData.get('child_id') ?? '').trim() || null;
  const trialistName = String(formData.get('trialist_name') ?? '').trim() || null;
  const amountPounds = Number(formData.get('amount') ?? '0');
  const creditPounds = Number(formData.get('credit_applied') ?? '0');
  const paymentMethod = String(formData.get('payment_method') ?? '').trim() || null;
  const paymentNote = String(formData.get('payment_note') ?? '').trim() || null;

  if (!sessionId) {
    redirect(`/admin/bookings/new?error=${encodeURIComponent('Choose a session')}`);
  }
  if (!Number.isFinite(amountPounds) || amountPounds < 0) {
    redirect(`/admin/bookings/new?error=${encodeURIComponent('Invalid amount')}`);
  }
  if (!Number.isFinite(creditPounds) || creditPounds < 0) {
    redirect(`/admin/bookings/new?error=${encodeURIComponent('Invalid credit amount')}`);
  }

  const admin = createSupabaseAdminClient();

  let parentId: string | null = null;
  if (!isGhost) {
    if (!childId) {
      redirect(`/admin/bookings/new?error=${encodeURIComponent('Choose a player')}`);
    }
    const { data: child } = await admin
      .from('children')
      .select('*')
      .eq('id', childId)
      .maybeSingle<Child>();
    if (!child) {
      redirect(`/admin/bookings/new?error=${encodeURIComponent('Player not found')}`);
    }
    parentId = child!.parent_id;
  } else {
    if (!trialistName) {
      redirect(`/admin/bookings/new?mode=ghost&error=${encodeURIComponent('Trialist name required')}`);
    }
  }

  const amountPence = Math.round(amountPounds * 100);
  const creditPence = isGhost ? 0 : Math.round(creditPounds * 100);

  const { data: bookingId, error } = await admin.rpc('admin_create_booking', {
    p_session_id: sessionId,
    p_parent_id: parentId,
    p_child_id: isGhost ? null : childId,
    p_is_ghost: isGhost,
    p_trialist_name: isGhost ? trialistName : null,
    p_amount_pence: amountPence,
    p_payment_method: paymentMethod,
    p_payment_note: paymentNote,
    p_credit_applied_pence: creditPence,
  });

  if (error) {
    const msg = humaniseRpcError(error.message);
    const back = isGhost ? '/admin/bookings/new?mode=ghost' : '/admin/bookings/new';
    redirect(`${back}&error=${encodeURIComponent(msg)}`.replace('?&', '?'));
  }

  // Email the parent on real bookings (best effort).
  if (!isGhost && bookingId) {
    try {
      const [{ data: booking }, { data: session }, { data: parent }, { data: child }] = await Promise.all([
        admin.from('bookings').select('*').eq('id', bookingId).maybeSingle<Booking>(),
        admin.from('sessions').select('*').eq('id', sessionId).maybeSingle<Session>(),
        admin.from('parents').select('*').eq('id', parentId!).maybeSingle<Parent>(),
        admin.from('children').select('*').eq('id', childId!).maybeSingle<Child>(),
      ]);
      if (booking && session && parent && child) {
        await sendBookingConfirmation({ booking, session, parent, child });
      }
    } catch (err) {
      console.error('Admin booking confirmation email failed', err);
    }
  }

  revalidatePath('/admin/bookings');
  redirect('/admin/bookings?success=Booking+created');
}

function humaniseRpcError(raw: string): string {
  if (raw.includes('session_full')) return 'This session is full.';
  if (raw.includes('session_closed')) return 'This session is closed.';
  if (raw.includes('session_not_found')) return 'Session not found.';
  if (raw.includes('ghost_requires_name')) return 'Ghost bookings need a trialist name.';
  if (raw.includes('insufficient_credit')) return 'Parent does not have enough credit.';
  if (raw.includes('invalid_payment_method')) return 'Invalid payment method.';
  if (raw.includes('real_booking_requires_parent_and_child')) return 'Parent and player are required.';
  return raw;
}
