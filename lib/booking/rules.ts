import type { Booking, Child, Session } from '@/lib/db/types';
import { formatDateLong } from '@/lib/format';

const APPROVAL_WINDOW_HOURS = 24;
const CANCELLATION_WINDOW_HOURS = 24;
const MAX_PLAYER_AGE = 16;

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

/**
 * Parents can move a confirmed booking themselves while it is still outside
 * the 24-hour window, to another session at the same price that is also
 * outside it. Money never changes hands, so anything else goes through
 * cancel-for-credit or the admin.
 */
export function parentCanMoveBooking(
  booking: Pick<Booking, 'status'>,
  from: Pick<Session, 'starts_at'>,
  nowMs = Date.now(),
): boolean {
  return booking.status === 'active' && cancellationIssuesCredit(from, nowMs);
}

export function isParentMoveTarget(
  from: Pick<Session, 'id' | 'price_pence'>,
  to: Pick<Session, 'id' | 'price_pence' | 'status' | 'starts_at'>,
  nowMs = Date.now(),
): boolean {
  return (
    to.id !== from.id &&
    to.status === 'open' &&
    to.price_pence === from.price_pence &&
    !bookingNeedsApproval(to, nowMs)
  );
}

/**
 * Whole years old on a given date (both YYYY-MM-DD). A 29 Feb birthday ticks
 * over on 1 March in non-leap years, matching UK law.
 */
export function ageOnDate(dob: string, date: string): number {
  const age = Number(date.slice(0, 4)) - Number(dob.slice(0, 4));
  return date.slice(5) < dob.slice(5) ? age - 1 : age;
}

/**
 * Sessions are for players aged 16 and under, judged on the session date so a
 * 16-year-old can't book past their 17th birthday. No DOB on file = allowed.
 */
export function playerTooOld(
  child: Pick<Child, 'dob'>,
  session: Pick<Session, 'date'>,
): boolean {
  return !!child.dob && ageOnDate(child.dob, session.date) > MAX_PLAYER_AGE;
}

/** Server-side fallback when an over-age booking gets past the form. */
export function playerTooOldMessage(
  child: Pick<Child, 'name'>,
  session: Pick<Session, 'date'>,
): string {
  return `Sorry, ${child.name} is 17 or over on ${formatDateLong(session.date)}, and our sessions are for ages 16 and under.`;
}

export const RULES = {
  APPROVAL_WINDOW_HOURS,
  CANCELLATION_WINDOW_HOURS,
  MAX_PLAYER_AGE,
};
