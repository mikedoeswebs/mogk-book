import { sessionIsPast } from './rules';
import type { Booking, Session } from '@/lib/db/types';

export const MILESTONES = [10, 25, 50];

/**
 * Same rule as the lapsed-players list: a past, confirmed booking counts
 * unless the register marks the player as missed. A session we cancelled
 * never counts, even while its bookings are still active awaiting a refund.
 */
export function countsAsAttended(
  b: Pick<Booking, 'status' | 'attended'>,
  s: Pick<Session, 'starts_at' | 'status'>,
): boolean {
  return b.status === 'active' && s.status === 'open' && sessionIsPast(s) && b.attended !== false;
}

/** The next badge to aim for, or undefined once every milestone is earned. */
export function nextMilestone(count: number): number | undefined {
  return MILESTONES.find((m) => count < m);
}
