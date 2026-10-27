import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { requireParent } from '@/lib/auth/require-parent';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe/client';

// Sends the parent to Stripe's hosted receipt for a card booking. Looked up on
// click rather than stored, so it also works for bookings paid before this
// existed. A bulk checkout is one payment, so its bookings share a receipt.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const parent = await requireParent();
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: booking } = await supabase
    .from('bookings')
    .select('stripe_payment_intent_id')
    .eq('id', id)
    .eq('parent_id', parent.id)
    .maybeSingle<{ stripe_payment_intent_id: string | null }>();

  let receiptUrl: string | null = null;
  if (booking?.stripe_payment_intent_id) {
    try {
      const pi = await getStripe().paymentIntents.retrieve(booking.stripe_payment_intent_id, {
        expand: ['latest_charge'],
      });
      receiptUrl = (pi.latest_charge as Stripe.Charge | null)?.receipt_url ?? null;
    } catch (err) {
      console.error('Receipt lookup failed', err);
    }
  }

  if (!receiptUrl) redirect('/bookings?error=Receipt+not+available+for+this+booking');
  redirect(receiptUrl);
}
