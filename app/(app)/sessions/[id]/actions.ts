'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireParent } from '@/lib/auth/require-parent';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe/client';
import { applyCredit, getCreditBalance } from '@/lib/booking/credits';
import { bookingFeeFor } from '@/lib/booking/fees';
import { bookingNeedsApproval, sessionIsPast } from '@/lib/booking/rules';
import { sendBookingConfirmation, sendBookingAwaitingApproval } from '@/lib/email/send';
import type { Session, Child, Booking, Parent } from '@/lib/db/types';

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

export async function createCheckoutSession(formData: FormData) {
  const parent = await requireParent();
  const sessionId = String(formData.get('session_id') ?? '');
  const childId = String(formData.get('child_id') ?? '');

  if (!sessionId || !childId) {
    redirect(`/sessions/${sessionId}?error=Missing+selection`);
  }

  const supabase = await createSupabaseServerClient();

  const [{ data: session }, { data: child }] = await Promise.all([
    supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle<Session>(),
    supabase
      .from('children')
      .select('*')
      .eq('id', childId)
      .eq('parent_id', parent.id)
      .maybeSingle<Child>(),
  ]);

  if (!session) redirect(`/sessions?error=Session+not+found`);
  if (session.status !== 'open') {
    redirect(`/sessions/${sessionId}?error=Session+is+closed`);
  }
  if (sessionIsPast(session)) {
    redirect(`/sessions/${sessionId}?error=This+session+has+already+taken+place`);
  }
  if (!child) redirect(`/sessions/${sessionId}?error=Invalid+player+selected`);

  const admin = createSupabaseAdminClient();
  const balance = await getCreditBalance(admin, parent.id);
  const { creditApplied, amountToCharge } = applyCredit(session.price_pence, balance);
  const feePence = bookingFeeFor(amountToCharge);
  const totalToCharge = amountToCharge + feePence;
  const needsApproval = bookingNeedsApproval(session);

  // ----- Scenario A: credit covers the full price (no Stripe needed) -----
  if (totalToCharge === 0) {
    const initialStatus = needsApproval ? 'awaiting_approval' : 'active';

    const { data: bookingId, error: rpcError } = await admin.rpc('try_reserve_booking', {
      p_session_id: session.id,
      p_parent_id: parent.id,
      p_child_id: child.id,
      p_amount_pence: 0,
      p_credit_applied_pence: creditApplied,
      p_booking_fee_pence: 0,
      p_initial_status: initialStatus,
      p_checkout_session_id: null,
    });

    if (rpcError) redirect(`/sessions/${session.id}?error=${encodeURIComponent(reserveErrorMessage(rpcError.message))}`);

    if (bookingId) {
      await sendBookingEmail(parent, child, session, bookingId, 0, creditApplied, needsApproval);
    }

    revalidatePath('/bookings');
    redirect(`/bookings?credit=${creditApplied}`);
  }

  // ----- Scenario B: Stripe Checkout for the remaining amount ------------
  const stripe = getStripe();
  const siteUrl = getSiteUrl();
  const creditLine = creditApplied > 0 ? ` (£${(creditApplied / 100).toFixed(2)} credit applied)` : '';

  const checkout = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: parent.email,
    line_items: [
      {
        price_data: {
          currency: 'gbp',
          unit_amount: amountToCharge,
          product_data: {
            name: `Goalkeeper coaching - ${session.date} ${session.start_time.slice(0, 5)}`,
            description: `Coach: ${session.coach_name}. For ${child.name}.${creditLine}`,
          },
        },
        quantity: 1,
      },
      {
        price_data: {
          currency: 'gbp',
          unit_amount: feePence,
          product_data: {
            name: 'Booking fee',
            description: 'Covers card processing. Non-refundable on cancellation.',
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${siteUrl}/bookings?paid=1`,
    cancel_url: `${siteUrl}/sessions/${session.id}?error=Payment+cancelled`,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 30,
    metadata: {
      parent_id: parent.id,
      child_id: child.id,
      session_id: session.id,
      needs_approval: needsApproval ? '1' : '0',
    },
  });

  const { error: rpcError } = await admin.rpc('try_reserve_booking', {
    p_session_id: session.id,
    p_parent_id: parent.id,
    p_child_id: child.id,
    p_amount_pence: totalToCharge,
    p_credit_applied_pence: creditApplied,
    p_booking_fee_pence: feePence,
    p_initial_status: 'pending_payment',
    p_checkout_session_id: checkout.id,
  });

  if (rpcError) {
    try { await stripe.checkout.sessions.expire(checkout.id); } catch { /* best-effort */ }
    redirect(`/sessions/${session.id}?error=${encodeURIComponent(reserveErrorMessage(rpcError.message))}`);
  }

  if (!checkout.url) {
    redirect(`/sessions/${session.id}?error=Could+not+start+payment`);
  }

  redirect(checkout.url);
}

function reserveErrorMessage(raw: string): string {
  if (raw.includes('session_full')) return 'This session just filled up.';
  if (raw.includes('session_closed')) return 'This session has been closed.';
  if (raw.includes('insufficient_credit')) return 'Your credit balance has changed. Try again.';
  return raw;
}

async function sendBookingEmail(
  parent: Parent,
  child: Child,
  session: Session,
  bookingId: string,
  amountPence: number,
  creditApplied: number,
  needsApproval: boolean,
) {
  const admin = createSupabaseAdminClient();
  const { data: booking } = await admin
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle<Booking>();
  if (!booking) return;

  const ctx = { booking, session, parent, child };
  try {
    if (needsApproval) {
      await sendBookingAwaitingApproval(ctx);
    } else {
      await sendBookingConfirmation(ctx);
    }
  } catch (err) {
    console.error('Booking email failed', err);
  }
  void amountPence; void creditApplied;
}
