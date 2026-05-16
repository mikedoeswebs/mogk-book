import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe/client';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  sendBookingConfirmation,
  sendBookingAwaitingApproval,
  sendBookingsBatchConfirmation,
  sendBookingsBatchAwaitingApproval,
} from '@/lib/email/send';
import { bookingNeedsApproval } from '@/lib/booking/rules';
import type { Booking, Session, Parent, Child } from '@/lib/db/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    return NextResponse.json({ error: `Signature: ${msg}` }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutCompleted(supabase, event.data.object as Stripe.Checkout.Session);
        break;
      }
      case 'checkout.session.expired': {
        await handleCheckoutExpired(supabase, event.data.object as Stripe.Checkout.Session);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error('Stripe webhook handler error', err);
    return NextResponse.json({ error: 'Handler failure' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  checkoutSession: Stripe.Checkout.Session,
) {
  const paymentIntentId =
    typeof checkoutSession.payment_intent === 'string'
      ? checkoutSession.payment_intent
      : checkoutSession.payment_intent?.id ?? null;

  // Load all pending bookings against this checkout (1 for the single-flow,
  // many for the bulk flow).
  const { data: pending } = await supabase
    .from('bookings')
    .select('*, sessions!session_id(*)')
    .eq('stripe_checkout_session_id', checkoutSession.id)
    .eq('status', 'pending_payment')
    .returns<(Booking & { sessions: Session })[]>();

  if (!pending || pending.length === 0) return;

  // Decide active vs awaiting_approval per row based on each session's start.
  const updates = pending.map((b) => {
    const status: Booking['status'] = bookingNeedsApproval(b.sessions) ? 'awaiting_approval' : 'active';
    return { id: b.id, status };
  });

  for (const u of updates) {
    await supabase
      .from('bookings')
      .update({ status: u.status, stripe_payment_intent_id: paymentIntentId })
      .eq('id', u.id);
  }

  // Reload bookings (with the new status) for the email.
  const ids = updates.map((u) => u.id);
  const { data: refreshed } = await supabase
    .from('bookings')
    .select('*, sessions!session_id(*), children(*)')
    .in('id', ids)
    .returns<(Booking & { sessions: Session; children: Child | null })[]>();

  if (!refreshed || refreshed.length === 0) return;

  const parentId = refreshed[0].parent_id;
  if (!parentId) return;
  const { data: parent } = await supabase
    .from('parents').select('*').eq('id', parentId).maybeSingle<Parent>();
  if (!parent) return;

  // Single-booking flow: keep the existing per-booking emails.
  if (refreshed.length === 1) {
    const b = refreshed[0];
    if (!b.children) return;
    const ctx = { booking: b, session: b.sessions, parent, child: b.children };
    try {
      if (b.status === 'awaiting_approval') {
        await sendBookingAwaitingApproval(ctx);
      } else {
        await sendBookingConfirmation(ctx);
      }
    } catch (err) {
      console.error('Confirmation email failed', err);
    }
    return;
  }

  // Bulk flow: send one batched email.
  const items = refreshed.map((b) => ({ booking: b, session: b.sessions, child: b.children }));
  const anyAwaiting = refreshed.some((b) => b.status === 'awaiting_approval');
  try {
    if (anyAwaiting) {
      await sendBookingsBatchAwaitingApproval({ parent, items });
    } else {
      await sendBookingsBatchConfirmation({ parent, items });
    }
  } catch (err) {
    console.error('Batch confirmation email failed', err);
  }
}

async function handleCheckoutExpired(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  checkoutSession: Stripe.Checkout.Session,
) {
  // Abandon all bookings on this checkout, return any applied credit.
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .eq('stripe_checkout_session_id', checkoutSession.id)
    .eq('status', 'pending_payment')
    .returns<Booking[]>();

  if (!bookings || bookings.length === 0) return;

  for (const b of bookings) {
    await supabase.from('bookings').update({ status: 'abandoned' }).eq('id', b.id);
    if (b.credit_applied_pence > 0 && b.parent_id) {
      await supabase.from('credits').insert({
        parent_id: b.parent_id,
        amount_pence: b.credit_applied_pence,
        reason: 'admin_adjustment',
        booking_id: b.id,
        note: 'Reversed: checkout expired',
      });
    }
  }
}
