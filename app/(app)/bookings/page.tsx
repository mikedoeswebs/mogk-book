import Link from 'next/link';
import { requireParent } from '@/lib/auth/require-parent';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCreditBalance } from '@/lib/booking/credits';
import { cancellationIssuesCredit } from '@/lib/booking/rules';
import { formatDate, formatTime, formatPence } from '@/lib/format';
import { ArrowLeft } from '@/lib/ui/Icon';
import type { Booking, Session, Child, CreditEntry } from '@/lib/db/types';
import { cancelBooking } from './actions';

type BookingWithJoins = Booking & {
  sessions: Session;
  children: Child;
};

const STATUS_LABEL: Record<Booking['status'], string> = {
  pending_payment: 'Payment pending',
  awaiting_approval: 'Awaiting admin approval',
  active: 'Confirmed',
  cancelled: 'Cancelled',
  abandoned: 'Abandoned',
};

const CANCEL_OUTCOME: Record<NonNullable<Booking['cancellation_outcome']>, string> = {
  credit_issued: 'Credit issued',
  no_refund_late: 'Cancelled (no credit - within 24h)',
  refunded_pre_service: 'Refunded',
  admin_cancelled: 'Session cancelled by admin',
};

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    paid?: string;
    error?: string;
    credit_issued?: string;
    cancelled_late?: string;
    refunded?: string;
    credit?: string;
  }>;
}) {
  const parent = await requireParent();
  const sp = await searchParams;

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const [{ data: bookings }, { data: ledger }, balance] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, sessions(*), children(*)')
      .eq('parent_id', parent.id)
      .neq('status', 'abandoned')
      .order('created_at', { ascending: false })
      .returns<BookingWithJoins[]>(),
    supabase
      .from('credits')
      .select('*')
      .eq('parent_id', parent.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .returns<CreditEntry[]>(),
    getCreditBalance(admin, parent.id),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My bookings</h1>

      <section className="p-3 bg-[var(--info-bg)] border border-[var(--info-line)] text-[var(--info-fg)] rounded">
        <strong>Credit balance:</strong> {formatPence(balance)}
        {balance > 0 && (
          <span className="ml-2 text-sm text-fg-muted">
            (auto-applied to your next booking)
          </span>
        )}
      </section>

      {sp.paid && (
        <Banner kind="success">
          Payment received. Your booking will be confirmed once Stripe notifies us - usually
          within seconds. Refresh this page if it doesn&apos;t update.
        </Banner>
      )}
      {sp.credit && (
        <Banner kind="success">
          Booking confirmed using {formatPence(Number(sp.credit))} of credit.
        </Banner>
      )}
      {sp.credit_issued && (
        <Banner kind="success">
          Cancellation confirmed. {formatPence(Number(sp.credit_issued))} added to your credit balance.
        </Banner>
      )}
      {sp.cancelled_late && (
        <Banner kind="info">
          Cancellation recorded. No credit applies as the session is within 24 hours.
        </Banner>
      )}
      {sp.refunded && (
        <Banner kind="success">
          Cancellation confirmed and your payment has been refunded to your card.
        </Banner>
      )}
      {sp.error && <Banner kind="error">{sp.error}</Banner>}

      {!bookings || bookings.length === 0 ? (
        <p>You don&apos;t have any bookings yet.</p>
      ) : (
        <div className="overflow-x-auto"><table>
          <thead>
            <tr>
              <th>Session</th>
              <th>Player</th>
              <th>Paid</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const refundable = cancellationIssuesCredit(b.sessions);
              const cancellable = b.status === 'active' || b.status === 'awaiting_approval';
              const statusLabel =
                b.status === 'cancelled' && b.cancellation_outcome
                  ? CANCEL_OUTCOME[b.cancellation_outcome]
                  : STATUS_LABEL[b.status];

              return (
                <tr key={b.id}>
                  <td>
                    {formatDate(b.sessions.date)} {formatTime(b.sessions.start_time)}<br />
                    <span className="text-sm text-fg-muted">
                      {b.sessions.coach_name}
                      {b.sessions.age_group ? ` | ${b.sessions.age_group}` : ''}
                    </span>
                  </td>
                  <td>{b.children.name}</td>
                  <td>
                    {formatPence(b.amount_pence)}
                    {b.booking_fee_pence > 0 && (
                      <div className="text-xs text-fg-muted">
                        incl. {formatPence(b.booking_fee_pence)} booking fee
                      </div>
                    )}
                    {b.credit_applied_pence > 0 && (
                      <div className="text-xs text-fg-muted">
                        + {formatPence(b.credit_applied_pence)} credit
                      </div>
                    )}
                  </td>
                  <td>{statusLabel}</td>
                  <td>
                    {cancellable && (
                      <form action={cancelBooking}>
                        <input type="hidden" name="id" value={b.id} />
                        <button type="submit">
                          {b.status === 'awaiting_approval'
                            ? 'Cancel (full refund)'
                            : refundable
                            ? 'Cancel (credit)'
                            : 'Cancel (no refund)'}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      )}

      {ledger && ledger.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xl font-bold">Credit history</h2>
          <div className="overflow-x-auto"><table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Change</th>
                <th>Reason</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((c) => (
                <tr key={c.id}>
                  <td className="text-sm">{new Date(c.created_at).toLocaleDateString('en-GB')}</td>
                  <td className={c.amount_pence > 0 ? 'text-[var(--ok-fg)]' : 'text-[var(--danger-fg)]'}>
                    {c.amount_pence > 0 ? '+' : ''}{formatPence(c.amount_pence)}
                  </td>
                  <td>{CREDIT_REASON[c.reason]}</td>
                  <td>{c.note ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </section>
      )}

      <p className="text-sm text-fg-muted">
        <Link href="/sessions"><ArrowLeft /> Browse more sessions</Link>
      </p>
    </div>
  );
}

const CREDIT_REASON: Record<CreditEntry['reason'], string> = {
  cancellation_refund: 'Cancellation credit',
  booking_applied: 'Applied to booking',
  admin_adjustment: 'Admin adjustment',
};

function Banner({
  kind,
  children,
}: {
  kind: 'success' | 'info' | 'error';
  children: React.ReactNode;
}) {
  const cls =
    kind === 'success'
      ? 'p-3 bg-[var(--ok-bg)] border border-[var(--ok-line)] text-[var(--ok-fg)] rounded'
      : kind === 'info'
      ? 'p-3 bg-[var(--warn-bg)] border border-[var(--warn-line)] text-[var(--warn-fg)] rounded'
      : 'p-3 bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger-fg)] rounded';
  return <p className={cls}>{children}</p>;
}
