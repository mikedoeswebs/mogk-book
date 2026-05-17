import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatDate, formatTime, formatPence } from '@/lib/format';
import { ArrowLeft } from '@/lib/ui/Icon';
import { SubmitButton } from '@/lib/ui/SubmitButton';
import type { Booking, Child, Parent, Session } from '@/lib/db/types';
import { updateAdminBooking } from './actions';

type Row = Booking & {
  sessions: Session;
  children: Child | null;
  parents: Parent | null;
};

export default async function EditAdminBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = createSupabaseAdminClient();

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, sessions!session_id(*), children(*), parents(*)')
    .eq('id', id)
    .maybeSingle<Row>();

  if (!booking) notFound();

  const playerLabel = booking.is_ghost
    ? `${booking.trialist_name ?? 'Trialist'} (ghost)`
    : `${booking.children?.name ?? '-'} (parent: ${booking.parents?.name ?? '-'})`;

  return (
    <div className="space-y-4">
      <p><Link href="/admin/bookings"><ArrowLeft /> Back to bookings</Link></p>
      <h1 className="text-2xl font-bold">Edit booking</h1>

      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1">
        <dt>Session</dt>
        <dd>
          {formatDate(booking.sessions.date)} {formatTime(booking.sessions.start_time)}–
          {formatTime(booking.sessions.end_time)}
          {booking.sessions.age_group ? ` | ${booking.sessions.age_group}` : ''}
        </dd>
        <dt>Player</dt><dd>{playerLabel}</dd>
        <dt>Status</dt><dd>{booking.status}</dd>
        <dt>Booking fee</dt><dd>{formatPence(booking.booking_fee_pence)}</dd>
      </dl>

      <p className="text-sm text-fg-muted">
        To change the session, player, or parent, cancel this booking and create a new one.
      </p>

      {sp.error && (
        <p className="p-3 bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger-fg)] rounded">{sp.error}</p>
      )}

      <form action={updateAdminBooking} className="space-y-3 max-w-md">
        <input type="hidden" name="id" value={booking.id} />

        <div className="flex gap-3">
          <label className="block flex-1">
            <span className="block mb-1">Paid amount (£)</span>
            <input
              type="number"
              name="amount"
              min={0}
              step="0.01"
              required
              defaultValue={(booking.amount_pence / 100).toFixed(2)}
              className="w-full"
            />
          </label>
          <label className="block flex-1">
            <span className="block mb-1">Payment method</span>
            <select
              name="payment_method"
              required
              defaultValue={booking.payment_method ?? 'cash'}
              className="w-full"
            >
              <option value="card">Card</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="free">Free</option>
              <option value="credit">Credit</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="block mb-1">Payment note (optional)</span>
          <textarea
            name="payment_note"
            rows={2}
            defaultValue={booking.payment_note ?? ''}
            className="w-full"
          />
        </label>

        <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
      </form>
    </div>
  );
}
