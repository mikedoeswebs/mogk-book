import type { Session } from '@/lib/db/types';

const APPROVAL_WINDOW_HOURS = 24;
const CANCELLATION_WINDOW_HOURS = 24;

export function sessionStartMs(session: Pick<Session, 'starts_at'>): number {
  return new Date(session.starts_at).getTime();
}

export function hoursUntilSession(session: Pick<Session, 'starts_at'>, nowMs = Date.now()): number {
  return (sessionStartMs(session) - nowMs) / (1000 * 60 * 60);
}

export function sessionIsPast(session: Pick<Session, 'starts_at'>, nowMs = Date.now()): boolean {
  return sessionStartMs(session) <= nowMs;
}

/**
 * Bookings made within 24 hours of session start need admin approval before
 * they're confirmed. Bookings made earlier auto-confirm on payment.
 */
export function bookingNeedsApproval(
  session: Pick<Session, 'starts_at'>,
  nowMs = Date.now(),
): boolean {
  return hoursUntilSession(session, nowMs) < APPROVAL_WINDOW_HOURS;
}

/**
 * Cancellations made ≥24h before session start issue a credit equal to what
 * the parent paid. Inside the window, the cancellation is recorded but no
 * money or credit changes hands (the slot is still freed for coach info).
 */
export function cancellationIssuesCredit(
  session: Pick<Session, 'starts_at'>,
  nowMs = Date.now(),
): boolean {
  return hoursUntilSession(session, nowMs) >= CANCELLATION_WINDOW_HOURS;
}

export const RULES = {
  APPROVAL_WINDOW_HOURS,
  CANCELLATION_WINDOW_HOURS,
};
