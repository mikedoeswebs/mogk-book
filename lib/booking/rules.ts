import type { Booking, Child, ClubEvent, Session } from '@/lib/db/types';
import { formatDateLong } from '@/lib/format';
import { sessionsClash } from '@/lib/booking/swap';

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
 * A confirmed paid booking can be swapped for a space on a clashing session
 * (e.g. the one the player was on the waiting list for), as long as both are
 * outside the 24-hour window. Unlike a move, the price may differ.
 */
export function canSwap(
  booking: Pick<Booking, 'status' | 'is_free_trial'>,
  from: Pick<Session, 'id' | 'date' | 'start_time' | 'end_time' | 'starts_at'>,
  to: Pick<Session, 'id' | 'date' | 'start_time' | 'end_time' | 'starts_at' | 'status'>,
  nowMs = Date.now(),
): boolean {
  return (
    booking.status === 'active' &&
    !booking.is_free_trial &&
    cancellationIssuesCredit(from, nowMs) &&
    to.status === 'open' &&
    !bookingNeedsApproval(to, nowMs) &&
    sessionsClash(from, to)
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

/** Mixed sessions take anyone; girls-only and boys-only take a matching player. */
export function playerCanJoin(
  child: Pick<Child, 'gender'>,
  session: Pick<Session, 'gender'>,
): boolean {
  return session.gender === 'mixed' || session.gender === child.gender;
}

/** 'Girls only' / 'Boys only', or null for a mixed session. */
export function sessionGenderLabel(session: Pick<Session, 'gender'>): string | null {
  if (session.gender === 'female') return 'Girls only';
  if (session.gender === 'male') return 'Boys only';
  return null;
}

/** Server-side fallback when an ineligible player gets past the form. */
export function playerCantJoinMessage(
  child: Pick<Child, 'name'>,
  session: Pick<Session, 'gender'>,
): string {
  return `Sorry, ${child.name} can't be booked on this session as it's ${sessionGenderLabel(session)?.toLowerCase()}.`;
}

export const RULES = {
  APPROVAL_WINDOW_HOURS,
  CANCELLATION_WINDOW_HOURS,
  MAX_PLAYER_AGE,
};

/** Event replies stay open until the reply-by date, or the event day if there isn't one. */
export function rsvpOpen(event: Pick<ClubEvent, 'date' | 'rsvp_by'>, today: string): boolean {
  return today <= (event.rsvp_by ?? event.date);
}
