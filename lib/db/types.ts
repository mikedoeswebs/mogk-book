export type BookingStatus =
  | 'pending_payment'
  | 'awaiting_approval'
  | 'active'
  | 'cancelled'
  | 'abandoned';

export type CancellationOutcome =
  | 'credit_issued'
  | 'no_refund_late'
  | 'refunded_pre_service'
  | 'admin_cancelled';

export type SessionStatus = 'open' | 'cancelled';

export type PlayerGender = 'male' | 'female';

/** Who a session is for; see migration 031. */
export type SessionGender = 'mixed' | PlayerGender;

export type CreditReason =
  | 'cancellation_refund'
  | 'booking_applied'
  | 'admin_adjustment';

export interface Coach {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
}

export interface SessionCoach {
  session_id: string;
  coach_id: string;
  notes: string | null;
  created_at: string;
}

export interface Parent {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  weekly_emails: boolean;
  /** Accounts created after the free trial launched; see lib/booking/trial.ts. */
  free_trial_eligible: boolean;
  terms_accepted_at: string | null;
  created_at: string;
}

export interface Child {
  id: string;
  parent_id: string;
  name: string;
  dob: string | null;
  gender: PlayerGender;
  position: string | null;
  notes: string | null;
  /** When the parent consented to us holding `notes` (health information). */
  medical_consent_at: string | null;
  media_consent_at: string | null;
  /** Main record when another parent registered the same player (migration 030). */
  same_as: string | null;
  created_at: string;
}

export type PaymentMethod =
  | 'card'
  | 'cash'
  | 'cheque'
  | 'bank_transfer'
  | 'free'
  | 'credit'
  | 'other';

export interface Session {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  coach_name: string;
  age_group: string | null;
  gender: SessionGender;
  capacity: number;
  price_pence: number;
  status: SessionStatus;
  notes: string | null;
  location: string;
  captain_booking_id: string | null;
  player_of_week_booking_id: string | null;
  theme: string | null;
  starts_at: string;
  admin_roster_sent_at: string | null;
  created_at: string;
}

export interface Booking {
  id: string;
  parent_id: string | null;
  child_id: string | null;
  session_id: string;
  status: BookingStatus;
  amount_pence: number;
  credit_applied_pence: number;
  booking_fee_pence: number;
  payment_method: PaymentMethod | null;
  payment_note: string | null;
  is_free_trial: boolean;
  is_ghost: boolean;
  trialist_name: string | null;
  attended: boolean | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_refund_id: string | null;
  cancellation_outcome: CancellationOutcome | null;
  cancellation_requested_at: string | null;
  cancellation_reason: string | null;
  /** Set on a booking made by swapping out of a clashing one; see migration 028. */
  swap_from_booking_id: string | null;
  swap_credit_pence: number;
  created_at: string;
  updated_at: string;
}

export interface WaitlistEntry {
  id: string;
  session_id: string;
  parent_id: string;
  child_id: string;
  created_at: string;
  last_notified_at: string | null;
}

export interface CreditEntry {
  id: string;
  parent_id: string;
  amount_pence: number;
  reason: CreditReason;
  booking_id: string | null;
  note: string | null;
  created_at: string;
}

/** Non-session event, e.g. the Christmas awards night. See migration 029. */
export interface ClubEvent {
  id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string | null;
  location: string;
  description: string | null;
  /** Last day to reply. Null means replies stay open until the event. */
  rsvp_by: string | null;
  /** Max adults + children across all replies. Null means no limit. */
  capacity: number | null;
  created_at: string;
}

/** One per parent per event. 0 adults + 0 children = can't make it. */
export interface EventRsvp {
  event_id: string;
  parent_id: string;
  adults: number;
  children: number;
  notes: string | null;
  updated_at: string;
}
