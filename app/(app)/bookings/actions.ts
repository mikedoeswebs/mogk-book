'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireParent } from '@/lib/auth/require-parent';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  sendCancellationCredit,
  sendCancellationNoRefund,
  sendCancellationRefunded,
  sendCancellationFreeTrial,
  sendAdminCancellation,
  sendBookingConfirmation,
} from '@/lib/email/send';
import { getStripe } from '@/lib/stripe/client';
import { clearWaitlistForBookings, notifyWaitlist } from '@/lib/booking/waitlist';
import { isParentMoveTarget, parentCanMoveBooking, playerTooOld } from '@/lib/booking/rules';
import type { Booking, Session, Parent, Child } from '@/lib/db/types';

type FullBooking = Booking & {
  sessions: Session;
  children: Child;
  parents: Parent;
};

export async function dismissPendingBooking(formData: FormData) {
  const parent = await requireParent();
  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/bookings?error=Missing+booking+id');

  const admin = createSupabaseAdminClient();

  const { data: booking } = await admin
    .from('bookings')
    .select('id, parent_id, session_id, status, credit_applied_pence, stripe_checkout_session_id')
    .eq('id', id)
    .maybeSingle<
      Pick<
        Booking,
        'id' | 'parent_id' | 'session_id' | 'status' | 'credit_applied_pence' | 'stripe_checkout_session_id'
      >
    >();

  if (!booking) redirect('/bookings?error=Booking+not+found');
  if (booking.parent_id !== parent.id) redirect('/bookings?error=Not+your+booking');
  if (booking.status !== 'pending_payment') {
    redirect('/bookings?error=Only+unpaid+bookings+can+be+dismissed');
  }

  // Expire the Stripe checkout session so a late payment can't flip this row
  // back to active after dismissal. The session may already be expired or
  // completed - swallow the error either way.
  if (booking.stripe_checkout_session_id) {
    try {
      await getStripe().checkout.sessions.expire(booking.stripe_checkout_session_id);
    } catch (err) {
      console.error('Stripe checkout expire failed', err);
    }
  }

  await admin.from('bookings').update({ status: 'abandoned' }).eq('id', id);

  // Reverse any credit applied at checkout - mirrors handleCheckoutExpired in
  // the webhook so the ledger stays balanced.
  if (booking.credit_applied_pence > 0) {
    await admin.from('credits').insert({
      parent_id: parent.id,
      amount_pence: booking.credit_applied_pence,
      reason: 'admin_adjustment',
      booking_id: booking.id,
      note: 'Reversed: dismissed by parent',
    });
  }

  await notifyWaitlist(admin, [booking.session_id]);

  revalidatePath('/bookings');
  redirect('/bookings?dismissed=1');
}

export async function cancelBooking(formData: FormData) {
  const parent = await requireParent();
  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/bookings?error=Missing+booking+id');

  const admin = createSupabaseAdminClient();

  // Load booking + joins BEFORE cancelling so we have everything we need for
  // post-cancellation actions (Stripe refund, email).
  const { data: pre } = await admin
    .from('bookings')
    .select('*, sessions!session_id(*), children(*), parents(*)')
    .eq('id', id)
    .maybeSingle<FullBooking>();

  if (!pre) redirect('/bookings?error=Booking+not+found');
  if (pre.parent_id !== parent.id) redirect('/bookings?error=Not+your+booking');

  const { data: result, error } = await admin.rpc('try_cancel_booking', {
    p_booking_id: id,
    p_parent_id: parent.id,
  });

  if (error) {
    redirect(`/bookings?error=${encodeURIComponent(humanise(error.message))}`);
  }

  const row = Array.isArray(result) ? result[0] : result;
  const outcome = row?.outcome as
    | 'credit_issued'
    | 'no_refund_late'
    | 'refunded_pre_service'
    | undefined;
  const creditPence = (row?.credit_issued_pence as number | undefined) ?? 0;
  // Only a late cancellation uses up a free trial; see lib/booking/trial.ts.
  const trialKept = pre.is_free_trial && outcome !== 'no_refund_late';

  // If the cancellation was on an unapproved booking, refund the cash -
  // excluding the booking fee, which is non-refundable.
  const refundablePence = pre.amount_pence - pre.booking_fee_pence;
  if (outcome === 'refunded_pre_service' && pre.stripe_payment_intent_id && refundablePence > 0) {
    try {
      const refund = await getStripe().refunds.create({
        payment_intent: pre.stripe_payment_intent_id,
        amount: refundablePence,
      });
      await admin
        .from('bookings')
        .update({ stripe_refund_id: refund.id })
        .eq('id', id);
    } catch (err) {
      console.error('Pre-service refund failed', err);
    }
  }

  // Fire the right email.
  try {
    const ctx = {
      booking: { ...pre, status: 'cancelled' as const },
      session: pre.sessions,
      parent: pre.parents,
      child: pre.children,
    };
    if (pre.is_free_trial) {
      await sendCancellationFreeTrial({ ...ctx, trialKept });
    } else if (outcome === 'credit_issued') {
      await sendCancellationCredit({ ...ctx, creditIssuedPence: creditPence });
    } else if (outcome === 'no_refund_late') {
      await sendCancellationNoRefund(ctx);
    } else if (outcome === 'refunded_pre_service') {
      await sendCancellationRefunded(ctx);
    }
  } catch (err) {
    console.error('Cancellation email failed', err);
  }

  // Let the admin know a parent cancelled.
  try {
    await sendAdminCancellation({
      parent: pre.parents,
      child: pre.children,
      session: pre.sessions,
      outcome: outcome ?? null,
      creditIssuedPence: creditPence,
      isFreeTrial: pre.is_free_trial,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
    });
  } catch (err) {
    console.error('Admin cancellation notice failed', err);
  }

  await notifyWaitlist(admin, [pre.session_id]);

  revalidatePath('/bookings');

  if (pre.is_free_trial) redirect(trialKept ? '/bookings?trial_kept=1' : '/bookings?trial_used=1');

  switch (outcome) {
    case 'credit_issued':
      redirect(`/bookings?credit_issued=${creditPence}`);
    case 'no_refund_late':
      redirect('/bookings?cancelled_late=1');
    case 'refunded_pre_service':
      redirect('/bookings?refunded=1');
    default:
      redirect('/bookings');
  }
}

// Parent self-service move. The window, price and age rules are checked here;
// admin_move_booking then locks both rows and re-checks capacity, session
// status and double booking. Money is untouched, as with an admin move.
export async function moveBooking(formData: FormData) {
  const parent = await requireParent();
  const id = String(formData.get('id') ?? '');
  const sessionId = String(formData.get('session_id') ?? '');
  if (!id) redirect('/bookings?error=Missing+booking+id');
  const back = `/bookings/${id}/move`;
  if (!sessionId) redirect(`${back}?error=Choose+a+session`);

  const admin = createSupabaseAdminClient();
  const [{ data: pre }, { data: target }] = await Promise.all([
    admin
      .from('bookings')
      .select('*, sessions!session_id(*), children(*), parents(*)')
      .eq('id', id)
      .maybeSingle<FullBooking>(),
    admin.from('sessions').select('*').eq('id', sessionId).maybeSingle<Session>(),
  ]);

  if (!pre || pre.parent_id !== parent.id) redirect('/bookings?error=Booking+not+found');
  if (!parentCanMoveBooking(pre, pre.sessions)) {
    redirect(`/bookings?error=${encodeURIComponent('Bookings can only be moved up to 24 hours before the session.')}`);
  }
  if (!target || !isParentMoveTarget(pre.sessions, target)) {
    redirect(`${back}?error=${encodeURIComponent('That session isn\'t available to move to.')}`);
  }
  if (playerTooOld(pre.children, target)) {
    redirect(`${back}?error=${encodeURIComponent(`${pre.children.name} is over the age limit on that date.`)}`);
  }

  const { error } = await admin.rpc('admin_move_booking', {
    p_booking_id: id,
    p_session_id: sessionId,
  });
  if (error) redirect(`${back}?error=${encodeURIComponent(humaniseMove(error.message))}`);

  await clearWaitlistForBookings(admin, [{ session_id: sessionId, child_id: pre.child_id }]);
  await notifyWaitlist(admin, [pre.session_id]);

  try {
    await sendBookingConfirmation({
      booking: { ...pre, session_id: sessionId, attended: null },
      session: target,
      parent: pre.parents,
      child: pre.children,
    });
  } catch (err) {
    console.error('Move confirmation email failed', err);
  }

  revalidatePath('/bookings');
  redirect('/bookings?moved=1');
}

function humaniseMove(raw: string): string {
  if (raw.includes('session_full')) return 'That session has just filled up.';
  if (raw.includes('already_booked')) return 'This player is already booked into that session.';
  if (raw.includes('session_closed')) return 'That session has been cancelled.';
  return 'The booking couldn\'t be moved. Please try again.';
}

function humanise(raw: string): string {
  if (raw.includes('booking_not_cancellable')) return 'This booking can\'t be cancelled in its current state.';
  if (raw.includes('not_your_booking')) return 'You can only cancel your own bookings.';
  if (raw.includes('booking_not_found')) return 'Booking not found.';
  return raw;
}
