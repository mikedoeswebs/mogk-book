'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireParent } from '@/lib/auth/require-parent';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe/client';
import { getCreditBalance } from '@/lib/booking/credits';
import { calculateBookingFeePence, allocateFeePence } from '@/lib/booking/fees';
import { bookingNeedsApproval, sessionIsPast } from '@/lib/booking/rules';
import {
  getSelection,
  setChildForRow,
  removeRow,
  clearSelection,
} from '@/lib/booking/selection';
import { formatDateLong } from '@/lib/format';
import {
  sendBookingsBatchConfirmation,
  sendBookingsBatchAwaitingApproval,
} from '@/lib/email/send';
import type { Booking, Child, Parent, Session } from '@/lib/db/types';

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

export async function confirmBookings(formData: FormData) {
  const parent = await requireParent();

  // Branch: a "Remove" button click inside the form.
  const removeRowId = String(formData.get('remove_row_id') ?? '').trim();
  if (removeRowId) {
    await removeRow(removeRowId);
    revalidatePath('/book');
    redirect('/book');
  }

  const selection = await getSelection();
  if (selection.items.length === 0) redirect('/sessions');

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  // Save each row's child selection to the cookie up front.
  for (const item of selection.items) {
    const childId = String(formData.get(`child_${item.id}`) ?? '').trim();
    if (childId) await setChildForRow(item.id, childId);
  }
  const fresh = await getSelection();

  // Load sessions + children + balance.
  const sessionIds = Array.from(new Set(fresh.items.map((i) => i.sessionId)));
  const [{ data: sessions }, { data: children }, balance] = await Promise.all([
    supabase.from('sessions').select('*').in('id', sessionIds).returns<Session[]>(),
    supabase.from('children').select('*').eq('parent_id', parent.id).returns<Child[]>(),
    getCreditBalance(admin, parent.id),
  ]);

  const sessionById = new Map((sessions ?? []).map((s) => [s.id, s]));
  const validChildIds = new Set((children ?? []).map((c) => c.id));

  const { data: availability } = await supabase.rpc('get_session_availability', {
    p_session_ids: sessionIds,
  });
  const remainingBySession = new Map<string, number>();
  for (const a of (availability ?? []) as { session_id: string; remaining: number }[]) {
    remainingBySession.set(a.session_id, a.remaining);
  }

  // Block duplicate bookings: same child already booked for the same session.
  const childIdsToCheck = fresh.items.map((i) => i.childId).filter(Boolean) as string[];
  if (childIdsToCheck.length > 0) {
    const { data: existing } = await supabase
      .from('bookings')
      .select('session_id, child_id')
      .in('session_id', sessionIds)
      .in('child_id', childIdsToCheck)
      .in('status', ['pending_payment', 'awaiting_approval', 'active']);
    const bookedPairs = new Set((existing ?? []).map((b) => `${b.session_id}:${b.child_id}`));
    for (const item of fresh.items) {
      if (item.childId && bookedPairs.has(`${item.sessionId}:${item.childId}`)) {
        const child = (children ?? []).find((c) => c.id === item.childId);
        const session = sessionById.get(item.sessionId);
        redirect(`/book?error=${encodeURIComponent(`${child?.name ?? 'A player'} is already booked on ${session ? formatDateLong(session.date) : 'one of these sessions'}.`)}`);
      }
    }
  }

  // Validate per-row, consuming a seat for each row of the same session.
  const valid: { item: typeof fresh.items[number]; session: Session }[] = [];
  for (const item of fresh.items) {
    const session = sessionById.get(item.sessionId);
    if (!session) redirect(`/book?error=${encodeURIComponent('A session is no longer available.')}`);
    if (session!.status !== 'open') redirect('/book?stale=1');
    if (sessionIsPast(session!)) redirect('/book?stale=1');
    const remaining = remainingBySession.get(item.sessionId) ?? session!.capacity;
    if (remaining <= 0) redirect('/book?stale=1');
    if (!item.childId) redirect(`/book?error=${encodeURIComponent('Assign a player to every line.')}`);
    if (!validChildIds.has(item.childId!)) {
      redirect(`/book?error=${encodeURIComponent('Invalid player selection.')}`);
    }
    remainingBySession.set(item.sessionId, remaining - 1);
    valid.push({ item, session: session! });
  }

  if (valid.length === 0) redirect('/sessions');

  // Totals + credit + fee allocation.
  const totalSessionPence = valid.reduce((s, r) => s + r.session.price_pence, 0);
  const creditAppliedTotal = Math.max(0, Math.min(totalSessionPence, balance));

  let remainingCredit = creditAppliedTotal;
  const perRow = valid.map((r) => {
    const take = Math.min(remainingCredit, r.session.price_pence);
    remainingCredit -= take;
    return {
      session: r.session,
      childId: r.item.childId!,
      cardPortion: r.session.price_pence - take,
      creditApplied: take,
    };
  });

  const amountToCharge = perRow.reduce((s, r) => s + r.cardPortion, 0);
  const totalFeePence = calculateBookingFeePence(amountToCharge);
  const feeShares = allocateFeePence(totalFeePence, perRow.map((r) => r.cardPortion));

  const items = perRow.map((r, i) => ({
    session_id: r.session.id,
    child_id: r.childId,
    credit_applied_pence: r.creditApplied,
    booking_fee_pence: feeShares[i] ?? 0,
    amount_pence: r.cardPortion === 0 ? 0 : r.cardPortion + (feeShares[i] ?? 0),
    initial_status:
      amountToCharge > 0
        ? 'pending_payment'
        : bookingNeedsApproval(r.session) ? 'awaiting_approval' : 'active',
  }));

  // ---------- Scenario A: credit covers everything ----------
  if (amountToCharge === 0) {
    const { data: ids, error } = await admin.rpc('try_reserve_bookings_bulk', {
      p_parent_id: parent.id,
      p_items: items,
      p_stripe_checkout_session_id: null,
      p_initial_status: 'active',
    });
    if (error) redirect(`/book?error=${encodeURIComponent(humanise(error.message))}`);

    await clearSelection();
    revalidatePath('/bookings');
    await sendBatchEmail(parent, (ids as string[]) ?? []);
    redirect(`/bookings?credit=${creditAppliedTotal}`);
  }

  // ---------- Scenario B: Stripe checkout ----------
  const stripe = getStripe();
  const siteUrl = getSiteUrl();

  const lineItems = perRow
    .filter((r) => r.cardPortion > 0)
    .map((r) => {
      const child = (children ?? []).find((c) => c.id === r.childId)!;
      const creditNote = r.creditApplied > 0
        ? ` (£${(r.creditApplied / 100).toFixed(2)} credit applied)`
        : '';
      return {
        price_data: {
          currency: 'gbp',
          unit_amount: r.cardPortion,
          product_data: {
            name: `Club MO/GK${r.session.age_group ? ` (${r.session.age_group})` : ''} - ${formatDateLong(r.session.date)}`,
            description: `For ${child.name}${creditNote}`,
          },
        },
        quantity: 1,
      };
    });

  if (totalFeePence > 0) {
    lineItems.push({
      price_data: {
        currency: 'gbp',
        unit_amount: totalFeePence,
        product_data: {
          name: 'Booking fee',
          description: 'Covers card processing. Non-refundable.',
        },
      },
      quantity: 1,
    });
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: parent.email,
    line_items: lineItems,
    success_url: `${siteUrl}/bookings?paid=1`,
    cancel_url: `${siteUrl}/book?error=Payment+cancelled`,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 30,
    metadata: {
      parent_id: parent.id,
      bulk: '1',
    },
  });

  const { error: rpcError } = await admin.rpc('try_reserve_bookings_bulk', {
    p_parent_id: parent.id,
    p_items: items,
    p_stripe_checkout_session_id: checkout.id,
    p_initial_status: 'pending_payment',
  });

  if (rpcError) {
    try { await stripe.checkout.sessions.expire(checkout.id); } catch { /* best-effort */ }
    redirect(`/book?error=${encodeURIComponent(humanise(rpcError.message))}`);
  }
  if (!checkout.url) {
    redirect('/book?error=Could+not+start+payment');
  }

  await clearSelection();
  redirect(checkout.url);
}

async function sendBatchEmail(parent: Parent, bookingIds: string[]) {
  if (bookingIds.length === 0) return;
  const admin = createSupabaseAdminClient();
  const { data: bookings } = await admin
    .from('bookings')
    .select('*, sessions!session_id(*), children(*)')
    .in('id', bookingIds)
    .returns<(Booking & { sessions: Session; children: Child | null })[]>();
  if (!bookings || bookings.length === 0) return;

  const items = bookings.map((b) => ({ booking: b, session: b.sessions, child: b.children }));
  const anyAwaiting = bookings.some((b) => b.status === 'awaiting_approval');
  try {
    if (anyAwaiting) {
      await sendBookingsBatchAwaitingApproval({ parent, items });
    } else {
      await sendBookingsBatchConfirmation({ parent, items });
    }
  } catch (err) {
    console.error('Batch booking email failed', err);
  }
}

function humanise(raw: string): string {
  if (raw.includes('session_full')) return 'A session in your selection just filled up.';
  if (raw.includes('session_closed')) return 'A session in your selection was cancelled.';
  if (raw.includes('session_not_found')) return 'A session in your selection is no longer available.';
  if (raw.includes('insufficient_credit')) return 'Your credit balance changed. Please refresh.';
  if (raw.includes('no_items')) return 'No sessions selected.';
  return raw;
}
