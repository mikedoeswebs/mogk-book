import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatDate, formatTime, formatPence } from '@/lib/format';
import { hoursUntilSession } from '@/lib/booking/rules';
import type { Booking, Session, Parent, Child } from '@/lib/db/types';
import { approveBooking, rejectBooking } from './actions';

type Row = Booking & { sessions: Session; children: Child | null; parents: Parent | null };

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const supabase = createSupabaseAdminClient();

  const { data } = await supabase
    .from('bookings')
    .select('*, sessions!session_id(*), children(*), parents(*)')
    .eq('status', 'awaiting_approval')
    .order('created_at', { ascending: true })
    .returns<Row[]>();

  const rows = data ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Bookings awaiting approval</h1>
      <p className="text-sm text-fg-muted">
        These bookings were made within 24 hours of the session start, so they need explicit
        admin approval before they&apos;re confirmed. Reject them to issue a full refund.
      </p>

      {sp.error && (
        <p className="p-3 bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger-fg)] rounded">{sp.error}</p>
      )}
      {sp.success && (
        <p className="p-3 bg-[var(--ok-bg)] border border-[var(--ok-line)] text-[var(--ok-fg)] rounded">{sp.success}</p>
      )}

      {rows.length === 0 ? (
        <p>Nothing pending.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((b) => {
            const hrs = hoursUntilSession(b.sessions);
            const hrsLabel = hrs >= 0 ? `${hrs.toFixed(1)}h away` : `started ${Math.abs(hrs).toFixed(1)}h ago`;
            return (
              <li key={b.id} className="border border-line rounded p-4 space-y-2">
                <div>
                  <strong>{b.is_ghost ? (b.trialist_name ?? 'Trialist') : (b.children?.name ?? '-')}</strong>
                  {b.is_ghost
                    ? <span className="ml-2 text-sm text-fg-muted">Ghost trialist</span>
                    : <> - {b.parents?.name ?? '-'} ({b.parents?.email ?? ''})</>}
                </div>
                <div>
                  Session: {formatDate(b.sessions.date)}{' '}
                  {formatTime(b.sessions.start_time)} with {b.sessions.coach_name}
                  {b.sessions.age_group ? ` | ${b.sessions.age_group}` : ''}
                  <span className="ml-2 text-sm text-fg-muted">({hrsLabel})</span>
                </div>
                <div>
                  Paid: {formatPence(b.amount_pence)}
                  {b.booking_fee_pence > 0 && (
                    <span className="ml-2 text-sm text-fg-muted">
                      (incl. {formatPence(b.booking_fee_pence)} booking fee)
                    </span>
                  )}
                  {b.credit_applied_pence > 0 && (
                    <span className="ml-2 text-sm text-fg-muted">
                      + {formatPence(b.credit_applied_pence)} credit
                    </span>
                  )}
                </div>
                <div className="text-sm text-fg-muted">
                  Booked: {new Date(b.created_at).toLocaleString('en-GB')}
                </div>
                <div className="flex gap-3 pt-2">
                  <form action={approveBooking}>
                    <input type="hidden" name="id" value={b.id} />
                    <button type="submit">Approve</button>
                  </form>
                  <form action={rejectBooking} className="flex gap-2">
                    <input type="hidden" name="id" value={b.id} />
                    <input type="text" name="reason" placeholder="Reason (optional)" />
                    <button type="submit">Reject &amp; refund</button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
