'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireParent } from '@/lib/auth/require-parent';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  sendCancellationCredit,
  sendCancellationNoRefund,
  sendCancellationRefunded,
} from '@/lib/email/send';
import { getStripe } from '@/lib/stripe/client';
import type { Booking, Session, Parent, Child } from '@/lib/db/types';

type FullBooking = Booking & {
  sessions: Session;
  children: Child;
  parents: Parent;
};

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
    if (outcome === 'credit_issued') {
      await sendCancellationCredit({ ...ctx, creditIssuedPence: creditPence });
    } else if (outcome === 'no_refund_late') {
      await sendCancellationNoRefund(ctx);
    } else if (outcome === 'refunded_pre_service') {
      await sendCancellationRefunded(ctx);
    }
  } catch (err) {
    console.error('Cancellation email failed', err);
  }

  revalidatePath('/bookings');

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

function humanise(raw: string): string {
  if (raw.includes('booking_not_cancellable')) return 'This booking can\'t be cancelled in its current state.';
  if (raw.includes('not_your_booking')) return 'You can only cancel your own bookings.';
  if (raw.includes('booking_not_found')) return 'Booking not found.';
  return raw;
}
