import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatDate, formatTime, formatPence } from '@/lib/format';
import { SubmitButton } from '@/lib/ui/SubmitButton';
import type { Booking, Session, Parent, Child } from '@/lib/db/types';
import { cancelAdminBooking } from './[id]/cancel/actions';

type Row = Booking & {
  sessions: Session;
  children: Child | null;
  parents: Parent | null;
};

const STATUS: Record<Booking['status'], string> = {
  pending_payment: 'Pending payment',
  awaiting_approval: 'Awaiting approval',
  active: 'Confirmed',
  cancelled: 'Cancelled',
  abandoned: 'Abandoned',
};

const METHOD_LABEL: Record<string, string> = {
  card: 'Card',
  cash: 'Cash',
  cheque: 'Cheque',
  bank_transfer: 'Bank',
  free: 'Free',
  credit: 'Credit',
  other: 'Other',
};

const STATUS_TABS: { value: Booking['status'] | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Confirmed' },
  { value: 'awaiting_approval', label: 'Awaiting approval' },
  { value: 'pending_payment', label: 'Pending payment' },
  { value: 'cancelled', label: 'Cancelled' },
];

const WHEN_TABS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
  { value: 'all', label: 'All time' },
] as const;
type When = (typeof WHEN_TABS)[number]['value'];

const PAGE_SIZE = 50;

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ when?: string; status?: string; page?: string; success?: string; error?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const supabase = createSupabaseAdminClient();

  const when: When = WHEN_TABS.some((w) => w.value === sp.when) ? (sp.when as When) : 'upcoming';
  const activeStatus = sp.status && sp.status !== 'all' ? sp.status : 'all';
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  // Resolve session ids for the time window. Filtering on sessions.date through
  // a joined embed is more fragile than just collecting the matching ids first
  // and using .in('session_id', ...) — which is also the same pattern the
  // dashboard uses.
  const today = new Date().toISOString().slice(0, 10);
  let timeIds: string[] | null = null;
  if (when !== 'all') {
    const q = supabase.from('sessions').select('id');
    const { data: sessionRows } = await (when === 'upcoming' ? q.gte('date', today) : q.lt('date', today));
    timeIds = (sessionRows ?? []).map((r) => r.id);
  }
  const emptyWindow = timeIds !== null && timeIds.length === 0;

  // List query (with FK-disambiguated embed; without that, PostgREST sees three
  // FK paths between bookings and sessions — forward via session_id, reverse
  // via sessions.captain_booking_id and player_of_week_booking_id from
  // migration 003 — and silently returns null data).
  const buildList = () => {
    let q = supabase
      .from('bookings')
      .select('*, sessions!session_id(*), children(*), parents(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (timeIds !== null) q = q.in('session_id', timeIds);
    if (activeStatus !== 'all') q = q.eq('status', activeStatus);
    return q.returns<Row[]>();
  };

  // Per-status counts, all respecting the current time window so the tab
  // numbers stay coherent ("147 confirmed upcoming" rather than 1834 lifetime).
  const buildCount = (statusFilter: Booking['status'] | 'all') => {
    let q = supabase.from('bookings').select('*', { count: 'exact', head: true });
    if (timeIds !== null) q = q.in('session_id', timeIds);
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    return q;
  };

  // If the time window has no sessions at all (e.g. brand-new install asking
  // for "past"), skip the queries entirely.
  const [listResult, ...countResults] = emptyWindow
    ? [{ data: [] as Row[], count: 0, error: null }, ...STATUS_TABS.map(() => ({ count: 0 }))]
    : await Promise.all([buildList(), ...STATUS_TABS.map((t) => buildCount(t.value))]);

  if (listResult.error) {
    console.error('[admin/bookings] list query error:', listResult.error);
  }
  const rows = listResult.data ?? [];
  const totalCount = listResult.count ?? 0;
  const counts = STATUS_TABS.map((_, i) => countResults[i]?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const fromIndex = totalCount === 0 ? 0 : offset + 1;
  const toIndex = Math.min(offset + PAGE_SIZE, totalCount);

  function buildHref(next: { when?: When; status?: string; page?: number }): string {
    const w = next.when ?? when;
    const s = next.status ?? activeStatus;
    const p = next.page ?? 1;
    const params = new URLSearchParams();
    if (w !== 'upcoming') params.set('when', w);
    if (s !== 'all') params.set('status', s);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return qs ? `/admin/bookings?${qs}` : '/admin/bookings';
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Bookings</h1>
        <div className="flex gap-4 items-center text-sm">
          <Link href="/admin/bookings/new">+ New booking</Link>
          <Link href="/admin/bookings/export">Export CSV</Link>
        </div>
      </div>

      {sp.success && (
        <p className="p-3 bg-[var(--ok-bg)] border border-[var(--ok-line)] text-[var(--ok-fg)] rounded">{sp.success}</p>
      )}
      {sp.error && (
        <p className="p-3 bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger-fg)] rounded">{sp.error}</p>
      )}

      {/* Time window. Sits above the status tabs because it's a coarser axis —
          changing it can change which status tabs are populated. */}
      <nav
        aria-label="Filter bookings by time"
        className="-mx-4 md:mx-0 overflow-x-auto"
      >
        <ul className="flex gap-2 px-4 md:px-0 py-1 min-w-max">
          {WHEN_TABS.map((w) => {
            const isActive = when === w.value;
            return (
              <li key={w.value}>
                <Link
                  href={buildHref({ when: w.value })}
                  aria-current={isActive ? 'page' : undefined}
                  className={[
                    'inline-flex items-center px-3.5 py-2 rounded-full border',
                    'font-heading uppercase tracking-wide font-bold text-xs whitespace-nowrap',
                    'no-underline! hover:no-underline! transition-colors',
                    isActive
                      ? 'bg-accent! border-accent text-accent-ink!'
                      : 'bg-surface! border-line text-fg! hover:bg-surface-2!',
                  ].join(' ')}
                >
                  {w.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Status pill tabs. Counts respect the active time window. */}
      <nav
        aria-label="Filter bookings by status"
        className="-mx-4 md:mx-0 overflow-x-auto"
      >
        <ul className="flex gap-2 px-4 md:px-0 py-1 min-w-max">
          {STATUS_TABS.map((t, i) => {
            const isActive = activeStatus === t.value;
            return (
              <li key={t.value}>
                <Link
                  href={buildHref({ status: t.value })}
                  aria-current={isActive ? 'page' : undefined}
                  className={[
                    'inline-flex items-center gap-2 px-3.5 py-2 rounded-full border',
                    'font-heading uppercase tracking-wide font-bold text-xs whitespace-nowrap',
                    'no-underline! hover:no-underline! transition-colors',
                    isActive
                      ? 'bg-accent! border-accent text-accent-ink!'
                      : 'bg-surface! border-line text-fg! hover:bg-surface-2!',
                  ].join(' ')}
                >
                  <span>{t.label}</span>
                  <span
                    className={[
                      'inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5',
                      'rounded-full text-[0.7rem] font-bold tabular-nums',
                      isActive
                        ? 'bg-accent-ink/15 text-accent-ink'
                        : 'bg-surface-2 text-fg-muted',
                    ].join(' ')}
                  >
                    {counts[i]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {rows.length === 0 ? (
        <p className="p-3 bg-surface border border-line rounded text-fg-muted">
          No bookings match this filter.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto"><table className="text-sm md:text-base min-w-[40rem]">
            <thead>
              <tr>
                <th>Session</th>
                <th>Player</th>
                <th>Parent</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Booked</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const playerName = b.is_ghost ? (b.trialist_name ?? 'Trialist') : (b.children?.name ?? '-');
                const parentLine = b.is_ghost
                  ? <span className="text-xs text-fg-muted">Ghost</span>
                  : (
                      <>
                        {b.parents?.name ?? '-'}<br />
                        <span className="text-sm text-fg-muted">{b.parents?.email ?? ''}</span>
                      </>
                    );
                const methodLabel = b.payment_method ? (METHOD_LABEL[b.payment_method] ?? b.payment_method) : '-';
                const cancellable = b.status === 'active' || b.status === 'awaiting_approval' || b.status === 'pending_payment';
                return (
                  <tr key={b.id}>
                    <td className="whitespace-nowrap">
                      {formatDate(b.sessions.date)} {formatTime(b.sessions.start_time)}<br />
                      <span className="text-sm text-fg-muted">{b.sessions.coach_name}</span>
                    </td>
                    <td>
                      {playerName}
                      {b.is_ghost && <span className="ml-1.5 text-xs text-fg-muted/70">(ghost)</span>}
                    </td>
                    <td>{parentLine}</td>
                    <td>
                      {formatPence(b.amount_pence)}
                      {b.booking_fee_pence > 0 && (
                        <div className="text-xs text-fg-muted">
                          incl. {formatPence(b.booking_fee_pence)} fee
                        </div>
                      )}
                    </td>
                    <td>{methodLabel}</td>
                    <td>{STATUS[b.status]}</td>
                    <td className="text-sm whitespace-nowrap">{new Date(b.created_at).toLocaleString('en-GB')}</td>
                    <td className="text-sm">
                      <Link href={`/admin/bookings/${b.id}/edit`}>Edit</Link>
                      {cancellable && (
                        <>
                          {' | '}
                          <form action={cancelAdminBooking} className="inline">
                            <input type="hidden" name="id" value={b.id} />
                            <input type="hidden" name="issue_credit" value={b.is_ghost ? '0' : '1'} />
                            <input
                              type="hidden"
                              name="refund_card"
                              value={b.payment_method === 'card' && b.stripe_payment_intent_id ? '1' : '0'}
                            />
                            <SubmitButton
                              className="text-[var(--danger-fg)] border-0 bg-transparent p-0 capitalize no-underline! hover:underline! font-normal tracking-normal"
                              pendingLabel="Cancelling…"
                            >
                              Cancel
                            </SubmitButton>
                          </form>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>

          <nav
            aria-label="Pagination"
            className="flex flex-wrap items-center justify-between gap-3 pt-2"
          >
            <p className="text-sm text-fg-muted">
              Showing {fromIndex}–{toIndex} of {totalCount}
              {totalPages > 1 && <> · Page {page} of {totalPages}</>}
            </p>
            <div className="flex gap-2 text-sm font-heading uppercase tracking-wide font-bold">
              <PageLink
                href={buildHref({ page: page - 1 })}
                disabled={page <= 1}
                label="← Prev"
              />
              <PageLink
                href={buildHref({ page: page + 1 })}
                disabled={page >= totalPages}
                label="Next →"
              />
            </div>
          </nav>
        </>
      )}
    </div>
  );
}

function PageLink({ href, disabled, label }: { href: string; disabled: boolean; label: string }) {
  const cls = 'inline-flex items-center px-3 py-1.5 rounded border text-xs no-underline! hover:no-underline! transition-colors';
  if (disabled) {
    return (
      <span className={`${cls} bg-surface border-line text-fg-muted opacity-50 cursor-not-allowed`}>
        {label}
      </span>
    );
  }
  return (
    <Link href={href} className={`${cls} bg-surface! border-line text-fg! hover:bg-surface-2!`}>
      {label}
    </Link>
  );
}
