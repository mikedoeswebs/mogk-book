import Link from 'next/link';
import { requireParent } from '@/lib/auth/require-parent';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCreditBalance } from '@/lib/booking/credits';
import { cancellationIssuesCredit, parentCanMoveBooking, sessionIsPast } from '@/lib/booking/rules';
import { hasFreeTrial } from '@/lib/booking/trial';
import { formatDate, formatTime, formatPence } from '@/lib/format';
import { ArrowLeft } from '@/lib/ui/Icon';
import { SubmitButton } from '@/lib/ui/SubmitButton';
import type { Booking, Session, Child, CreditEntry, WaitlistEntry } from '@/lib/db/types';
import { cancelBooking, dismissPendingBooking } from './actions';
import { leaveWaitlist } from '../sessions/[id]/actions';

type BookingWithJoins = Booking & {
  sessions: Session;
  children: Child;
};

type WaitlistWithJoins = WaitlistEntry & {
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
    dismissed?: string;
    moved?: string;
    trial?: string;
    trial_kept?: string;
    trial_used?: string;
    p?: string;
  }>;
}) {
  const parent = await requireParent();
  const sp = await searchParams;
  const bookingPage = Math.max(1, Number.parseInt(sp.p ?? '1', 10) || 1);
  const bookingOffset = (bookingPage - 1) * BOOKINGS_PAGE_SIZE;

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const [{ data: bookings }, { data: ledger }, balance, { data: waitlist }, freeTrial] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, sessions!session_id(*), children(*)')
      .eq('parent_id', parent.id)
      .neq('status', 'abandoned')
      .returns<BookingWithJoins[]>(),
    supabase
      .from('credits')
      .select('*')
      .eq('parent_id', parent.id)
      .neq('amount_pence', 0)
      .order('created_at', { ascending: false })
      .limit(20)
      .returns<CreditEntry[]>(),
    getCreditBalance(admin, parent.id),
    supabase
      .from('waitlist_entries')
      .select('*, sessions!session_id(*), children(*)')
      .eq('parent_id', parent.id)
      .returns<WaitlistWithJoins[]>(),
    hasFreeTrial(supabase, parent),
  ]);

  const upcomingWaitlist = (waitlist ?? [])
    .filter((w) => w.sessions && w.children && !sessionIsPast(w.sessions))
    .sort((a, b) => a.sessions.starts_at.localeCompare(b.sessions.starts_at));

  // Upcoming = still going ahead; everything else (past or cancelled) is history.
  const all = bookings ?? [];
  const isUpcoming = (b: BookingWithJoins) =>
    b.status !== 'cancelled' && !sessionIsPast(b.sessions);
  const upcoming = all
    .filter(isUpcoming)
    .sort((a, b) => a.sessions.starts_at.localeCompare(b.sessions.starts_at));
  const history = all
    .filter((b) => !isUpcoming(b))
    .sort((a, b) => b.sessions.starts_at.localeCompare(a.sessions.starts_at));
  const bookingsTotal = history.length;
  const bookingTotalPages = Math.max(1, Math.ceil(bookingsTotal / BOOKINGS_PAGE_SIZE));
  const pagedBookings = history.slice(
    bookingOffset,
    bookingOffset + BOOKINGS_PAGE_SIZE,
  );

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
      {sp.trial && (
        <Banner kind="success">
          Your free trial session is booked - we&apos;ve emailed you the details. See you there!
        </Banner>
      )}
      {sp.trial_kept && (
        <Banner kind="success">
          Cancellation confirmed. Your free trial is still available, so you can book another session for free.
        </Banner>
      )}
      {sp.trial_used && (
        <Banner kind="info">
          Cancellation recorded. As the session is within 24 hours, your free trial has been used.
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
      {sp.dismissed && (
        <Banner kind="info">
          Unpaid booking removed. If you&apos;d still like to book, start again from Sessions.
        </Banner>
      )}
      {sp.moved && (
        <Banner kind="success">
          Booking moved - we&apos;ve emailed you the new details.
        </Banner>
      )}
      {sp.error && <Banner kind="error">{sp.error}</Banner>}

      {all.length === 0 ? (
        <p>
          You don&apos;t have any bookings yet.
          {freeTrial && (
            <> Your first session is a <strong>free trial</strong> - <Link href="/sessions">pick a session</Link> to get started.</>
          )}
        </p>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-xl font-bold">Upcoming</h2>
            {upcoming.length === 0 ? (
              <p className="text-fg-muted">Nothing booked. <Link href="/sessions">Browse sessions</Link>.</p>
            ) : (
              <BookingsTable rows={upcoming} />
            )}
          </section>
          {bookingsTotal > 0 && (
            <section className="space-y-3">
              <h2 className="text-xl font-bold">Past and cancelled</h2>
              <BookingsTable rows={pagedBookings} />
              {bookingsTotal > BOOKINGS_PAGE_SIZE && (
                <nav
                  aria-label="Bookings pagination"
                  className="flex flex-wrap items-center justify-between gap-3"
                >
                  <p className="text-sm text-fg-muted">
                    Showing {bookingOffset + 1}–{Math.min(bookingOffset + BOOKINGS_PAGE_SIZE, bookingsTotal)} of {bookingsTotal} · Page {bookingPage} of {bookingTotalPages}
                  </p>
                  <div className="flex gap-2 text-sm font-heading uppercase tracking-wide font-bold">
                    <BookingPageLink page={bookingPage - 1} disabled={bookingPage <= 1} label="← Prev" />
                    <BookingPageLink page={bookingPage + 1} disabled={bookingPage >= bookingTotalPages} label="Next →" />
                  </div>
                </nav>
              )}
            </section>
          )}
        </>
      )}

      {upcomingWaitlist.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xl font-bold">Waiting lists</h2>
          <p className="text-sm text-fg-muted">
            We&apos;ll email you if a space opens up. Spaces go to whoever books first.
          </p>
          <div className="overflow-x-auto"><table>
            <thead>
              <tr>
                <th>Session</th>
                <th>Player</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {upcomingWaitlist.map((w) => (
                <tr key={w.id}>
                  <td>
                    <Link href={`/sessions/${w.session_id}`}>
                      {formatDate(w.sessions.date)} {formatTime(w.sessions.start_time)}
                    </Link>
                    {w.sessions.age_group && (
                      <span className="text-sm text-fg-muted"> ({w.sessions.age_group})</span>
                    )}
                  </td>
                  <td>{w.children.name}</td>
                  <td className="text-right">
                    <form action={leaveWaitlist}>
                      <input type="hidden" name="id" value={w.id} />
                      <input type="hidden" name="return_to" value="/bookings" />
                      <SubmitButton pendingLabel="Leaving…">Leave</SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </section>
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

const BOOKINGS_PAGE_SIZE = 10;

const CREDIT_REASON: Record<CreditEntry['reason'], string> = {
  cancellation_refund: 'Cancellation credit',
  booking_applied: 'Applied to booking',
  admin_adjustment: 'Admin adjustment',
};

function BookingsTable({ rows }: { rows: BookingWithJoins[] }) {
  return (
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
        {rows.map((b) => {
          const refundable = cancellationIssuesCredit(b.sessions);
          const cancellable =
            (b.status === 'active' || b.status === 'awaiting_approval') && !sessionIsPast(b.sessions);
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
                {b.is_free_trial ? 'Free trial' : formatPence(b.amount_pence)}
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
              <td className="space-y-1">
                {parentCanMoveBooking(b, b.sessions) && (
                  <Link href={`/bookings/${b.id}/move`} className="block text-sm">Move</Link>
                )}
                {cancellable && (
                  <form action={cancelBooking}>
                    <input type="hidden" name="id" value={b.id} />
                    <SubmitButton pendingLabel="Cancelling…">
                      {b.is_free_trial
                        ? b.status === 'awaiting_approval' || refundable
                          ? 'Cancel (trial kept)'
                          : 'Cancel (trial used)'
                        : b.status === 'awaiting_approval'
                        ? 'Cancel (full refund)'
                        : refundable
                        ? 'Cancel (credit)'
                        : 'Cancel (no refund)'}
                    </SubmitButton>
                  </form>
                )}
                {b.status === 'pending_payment' && (
                  <form action={dismissPendingBooking}>
                    <input type="hidden" name="id" value={b.id} />
                    <SubmitButton pendingLabel="Dismissing…">Dismiss</SubmitButton>
                  </form>
                )}
                {b.stripe_payment_intent_id && b.amount_pence > 0 && (
                  <a href={`/bookings/${b.id}/receipt`} target="_blank" rel="noopener" className="block text-sm">
                    Receipt
                  </a>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table></div>
  );
}

function BookingPageLink({
  page,
  disabled,
  label,
}: {
  page: number;
  disabled: boolean;
  label: string;
}) {
  const cls =
    'inline-flex items-center px-3 py-1.5 rounded border text-xs no-underline! hover:no-underline! transition-colors';
  if (disabled) {
    return (
      <span
        className={`${cls} bg-surface border-line text-fg-muted opacity-50 cursor-not-allowed`}
      >
        {label}
      </span>
    );
  }
  const href = page > 1 ? `/bookings?p=${page}` : '/bookings';
  return (
    <Link
      href={href}
      className={`${cls} bg-surface! border-line text-fg! hover:bg-surface-2!`}
    >
      {label}
    </Link>
  );
}

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
