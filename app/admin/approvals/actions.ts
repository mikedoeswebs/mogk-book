'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe/client';
import {
  sendBookingApproved,
  sendBookingRejected,
} from '@/lib/email/send';
import type { Booking, Session, Parent, Child } from '@/lib/db/types';

type FullBooking = Booking & {
  sessions: Session;
  children: Child;
  parents: Parent;
};

async function loadBooking(id: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('bookings')
    .select('*, sessions(*), children(*), parents(*)')
    .eq('id', id)
    .maybeSingle<FullBooking>();
  return { supabase, row: data };
}

export async function approveBooking(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/admin/approvals?error=Missing+id');

  const { supabase, row } = await loadBooking(id);
  if (!row) redirect('/admin/approvals?error=Booking+not+found');
  if (row.status !== 'awaiting_approval') {
    redirect('/admin/approvals?error=Booking+is+not+pending+approval');
  }

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'active' })
    .eq('id', id);

  if (error) redirect(`/admin/approvals?error=${encodeURIComponent(error.message)}`);

  try {
    await sendBookingApproved({
      booking: { ...row, status: 'active' },
      session: row.sessions,
      parent: row.parents,
      child: row.children,
    });
  } catch (err) {
    console.error('Approval email failed', err);
  }

  revalidatePath('/admin/approvals');
  redirect('/admin/approvals?success=Booking+approved');
}

export async function rejectBooking(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  const reason = String(formData.get('reason') ?? '').trim() || null;
  if (!id) redirect('/admin/approvals?error=Missing+id');

  const { supabase, row } = await loadBooking(id);
  if (!row) redirect('/admin/approvals?error=Booking+not+found');
  if (row.status !== 'awaiting_approval') {
    redirect('/admin/approvals?error=Booking+is+not+pending+approval');
  }

  // Refund any cash paid via Stripe, less the (non-refundable) booking fee.
  let refundId: string | null = null;
  const refundablePence = row.amount_pence - row.booking_fee_pence;
  if (row.stripe_payment_intent_id && refundablePence > 0) {
    try {
      const refund = await getStripe().refunds.create({
        payment_intent: row.stripe_payment_intent_id,
        amount: refundablePence,
      });
      refundId = refund.id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Refund failed';
      redirect(`/admin/approvals?error=${encodeURIComponent(msg)}`);
    }
  }

  // Reverse any credit that was applied.
  if (row.credit_applied_pence > 0) {
    await supabase.from('credits').insert({
      parent_id: row.parent_id,
      amount_pence: row.credit_applied_pence,
      reason: 'admin_adjustment',
      booking_id: row.id,
      note: 'Returned: booking rejected by admin',
    });
  }

  const { error } = await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      cancellation_outcome: 'refunded_pre_service',
      cancellation_reason: reason,
      stripe_refund_id: refundId,
    })
    .eq('id', id);

  if (error) redirect(`/admin/approvals?error=${encodeURIComponent(error.message)}`);

  try {
    await sendBookingRejected({
      booking: { ...row, status: 'cancelled' },
      session: row.sessions,
      parent: row.parents,
      child: row.children,
      reason: reason ?? undefined,
    });
  } catch (err) {
    console.error('Rejection email failed', err);
  }

  revalidatePath('/admin/approvals');
  redirect('/admin/approvals?success=Booking+rejected+and+refunded');
}
