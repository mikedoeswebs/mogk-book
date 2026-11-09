import type { Booking, Session } from '@/lib/db/types';

type Times = Pick<Session, 'id' | 'date' | 'start_time' | 'end_time'>;

/** Two different sessions on the same day whose times overlap. */
export function sessionsClash(a: Times, b: Times): boolean {
  return (
    a.id !== b.id &&
    a.date === b.date &&
    a.start_time < b.end_time &&
    b.start_time < a.end_time
  );
}

/**
 * How a swap is paid for. The old booking is worth what a >=24h cancellation
 * would credit; up to the new price of that moves across, then the credit
 * balance, then card. Any surplus stays in the balance. Mirrors the checks in
 * start_booking_swap (migration 028), which refuses a mismatch.
 */
export function swapAmounts(
  from: Pick<Booking, 'amount_pence' | 'booking_fee_pence' | 'credit_applied_pence'>,
  newPricePence: number,
  balancePence: number,
) {
  const value = from.amount_pence - from.booking_fee_pence + from.credit_applied_pence;
  const swapCredit = Math.min(value, newPricePence);
  const balanceCredit = Math.max(0, Math.min(newPricePence - swapCredit, balancePence));
  return {
    swapCredit,
    balanceCredit,
    card: newPricePence - swapCredit - balanceCredit,
    surplus: value - swapCredit,
  };
}
