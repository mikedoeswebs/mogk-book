/**
 * Stripe (UK card) costs us 1.5% + 20p per *transaction* - not per booking.
 * We pass that through transparently as a single "booking fee" line item.
 *
 * Grossed up so the fee covers Stripe's cut on the total charge (session + fee),
 * not just the session price - otherwise we lose 1p per transaction because
 * Stripe takes 1.5% of what the parent actually pays.
 *
 * Single £12 session ⇒ ceil(1220 / 0.985) − 1200 = 39p, parent pays £12.39,
 * Stripe takes 39p, we net £12 exactly.
 */
const STRIPE_PERCENT = 0.015;
const STRIPE_FIXED_PENCE = 20;

export function calculateBookingFeePence(cardPaymentPence: number): number {
  if (cardPaymentPence <= 0) return 0;
  const gross = Math.ceil(
    (cardPaymentPence + STRIPE_FIXED_PENCE) / (1 - STRIPE_PERCENT),
  );
  return gross - cardPaymentPence;
}

/**
 * For bulk transactions, the per-transaction fee is split across the bookings
 * in proportion to their share of the card payment. This way a cancellation
 * for any one booking only forfeits that booking's share - not the whole fee.
 *
 * Rounding: floor each share, then dole out the remainder to the largest
 * payments first so the slices sum exactly to the total fee.
 */
export function allocateFeePence(
  totalFeePence: number,
  perBookingCardPaymentPence: number[],
): number[] {
  const total = perBookingCardPaymentPence.reduce((a, b) => a + b, 0);
  if (totalFeePence <= 0 || total <= 0) {
    return perBookingCardPaymentPence.map(() => 0);
  }

  const raw = perBookingCardPaymentPence.map((p) => (p * totalFeePence) / total);
  const floored = raw.map(Math.floor);
  let leftover = totalFeePence - floored.reduce((a, b) => a + b, 0);

  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);

  for (const { i } of order) {
    if (leftover <= 0) break;
    floored[i] += 1;
    leftover -= 1;
  }

  return floored;
}

/**
 * Back-compat shim for the single-booking callers. Keeps the old name + shape
 * so we don't have to touch every caller until the bulk flow lands.
 */
export function bookingFeeFor(cardPaymentPence: number): number {
  return calculateBookingFeePence(cardPaymentPence);
}

export const STRIPE_BOOKING_FEE_PENCE = 50; // kept for places that display "around 50p"
