'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe/client';
import { sendCancellationCredit, sendCancellationRefunded } from '@/lib/email/send';
import type { Booking, Child, Parent, Session } from '@/lib/db/types';

type Row = Booking & {
  sessions: Session;
  children: Child | null;
  parents: Parent | null;
};

type CancelResult = {
  amount_pence: number;
  booking_fee_pence: number;
  credit_applied_pence: number;
  payment_method: string | null;
  stripe_payment_intent_id: string | null;
  credit_issued_pence: number;
  is_ghost: boolean;
};

export async function cancelAdminBooking(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get('id') ?? '').trim();
  const issueCredit = String(formData.get('issue_credit') ?? '0') === '1';
  const refundCard = String(formData.get('refund_card') ?? '0') === '1';
  const reason = String(formData.get('reason') ?? '').trim() || null;

  if (!id) redirect('/admin/bookings?error=Missing+booking+id');

  const admin = createSupabaseAdminClient();

  const { data: pre } = await admin
    .from('bookings')
    .select('*, sessions!session_id(*), children(*), parents(*)')
    .eq('id', id)
    .maybeSingle<Row>();

  if (!pre) redirect('/admin/bookings?error=Booking+not+found');

  const { data: rpcRows, error } = await admin.rpc('admin_cancel_booking', {
    p_booking_id: id,
    p_issue_credit: issueCredit,
    p_reason: reason,
  });

  if (error) {
    redirect(`/admin/bookings?error=${encodeURIComponent(humanise(error.message))}`);
  }

  const result: CancelResult | undefined = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;

  // Refund card if requested and applicable.
  let refundId: string | null = null;
  if (
    refundCard &&
    result?.payment_method === 'card' &&
    result.stripe_payment_intent_id &&
    result.amount_pence - result.booking_fee_pence > 0
  ) {
    try {
      const refund = await getStripe().refunds.create({
        payment_intent: result.stripe_payment_intent_id,
        amount: result.amount_pence - result.booking_fee_pence,
      });
      refundId = refund.id;
      await admin.from('bookings').update({ stripe_refund_id: refundId }).eq('id', id);
    } catch (err) {
      console.error('Admin Stripe refund failed', err);
    }
  }

  // Email the parent (best effort, real bookings only).
  if (!pre.is_ghost && pre.parents && pre.children) {
    try {
      const cancelledBooking: Booking = { ...pre, status: 'cancelled' };
      const ctx = {
        booking: cancelledBooking,
        session: pre.sessions,
        parent: pre.parents,
        child: pre.children,
      };
      if (refundId) {
        await sendCancellationRefunded(ctx);
      } else if (result?.credit_issued_pence && result.credit_issued_pence > 0) {
        await sendCancellationCredit({ ...ctx, creditIssuedPence: result.credit_issued_pence });
      }
    } catch (err) {
      console.error('Admin cancellation email failed', err);
    }
  }

  revalidatePath('/admin/bookings');
  redirect('/admin/bookings?success=Booking+cancelled');
}

function humanise(raw: string): string {
  if (raw.includes('booking_not_cancellable')) return 'This booking can\'t be cancelled.';
  if (raw.includes('booking_not_found')) return 'Booking not found.';
  return raw;
}
