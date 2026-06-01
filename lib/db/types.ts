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
  terms_accepted_at: string | null;
  created_at: string;
}

export interface Child {
  id: string;
  parent_id: string;
  name: string;
  dob: string | null;
  position: string | null;
  notes: string | null;
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
  capacity: number;
  price_pence: number;
  status: SessionStatus;
  notes: string | null;
  location: string;
  captain_booking_id: string | null;
  player_of_week_booking_id: string | null;
  session_report_notes: string | null;
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
  is_ghost: boolean;
  trialist_name: string | null;
  attended: boolean | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_refund_id: string | null;
  cancellation_outcome: CancellationOutcome | null;
  cancellation_requested_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
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
