import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatDate, formatDob, formatPence } from '@/lib/format';
import { ArrowLeft } from '@/lib/ui/Icon';
import type {
  Parent,
  Child,
  CreditEntry,
  Booking,
  Session,
} from '@/lib/db/types';
import { adjustCredit, claimGhost } from './actions';
import { DeleteChildButton } from './DeleteChildButton';

const REASON_LABEL: Record<string, string> = {
  cancellation_refund: 'Cancellation refund',
  booking_applied: 'Applied to booking',
  admin_adjustment: 'Admin adjustment',
};

const STATUS_LABEL: Record<Booking['status'], string> = {
  pending_payment: 'Pending payment',
  awaiting_approval: 'Awaiting approval',
  active: 'Confirmed',
  cancelled: 'Cancelled',
  abandoned: 'Abandoned',
};

const BOOKINGS_PAGE_SIZE = 10;

export default async function AdminParentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; bp?: string; error?: string; success?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const ghostQ = (sp.q ?? '').trim();
  const bookingPage = Math.max(1, Number.parseInt(sp.bp ?? '1', 10) || 1);
  const bookingOffset = (bookingPage - 1) * BOOKINGS_PAGE_SIZE;

  const supabase = createSupabaseAdminClient();

  const [
    { data: parent },
    { data: children },
    { data: balance },
    { data: entries },
    { data: bookings },
  ] = await Promise.all([
    supabase.from('parents').select('*').eq('id', id).maybeSingle<Parent>(),
    supabase
      .from('children')
      .select('*')
      .eq('parent_id', id)
      .order('name', { ascending: true })
      .returns<Child[]>(),
    supabase.rpc('parent_credit_balance', { p_parent_id: id }),
    supabase
      .from('credits')
      .select('*')
      .eq('parent_id', id)
      .order('created_at', { ascending: false })
      .limit(50)
      .returns<CreditEntry[]>(),
    // PostgREST can only order by an embedded column within that embed, not
    // the outer row set, so fetch all of the parent's bookings and sort by
    // sessions.date in JS before paginating below.
    supabase
      .from('bookings')
      .select('*, sessions!session_id(*)')
      .eq('parent_id', id)
      .returns<(Booking & { sessions: Session })[]>(),
  ]);

  if (!parent) notFound();

  // PostgREST caps a single response at 1000 rows regardless of .limit().
  // Page through until the table is drained so newer ghosts past the first
  // 1000 still appear in the trialist-group list.
  type GhostRow = Pick<Booking, 'id' | 'trialist_name' | 'session_id' | 'amount_pence'>;
  const ghostRows: GhostRow[] = [];
  let ghostError: { message: string } | null = null;
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('bookings')
      .select('id, trialist_name, session_id, amount_pence')
      .eq('is_ghost', true)
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1)
      .returns<GhostRow[]>();
    if (error) { ghostError = error; break; }
    if (!data || data.length === 0) break;
    ghostRows.push(...data);
    if (data.length < pageSize) break;
  }

  const ghostSessionIds = Array.from(
    new Set(ghostRows.map((b) => b.session_id)),
  );
  const { data: ghostSessions } =
    ghostSessionIds.length > 0
      ? await supabase
          .from('sessions')
          .select('id, date')
          .in('id', ghostSessionIds)
          .returns<Pick<Session, 'id' | 'date'>[]>()
      : { data: [] as Pick<Session, 'id' | 'date'>[] };
  const ghostSessionById = new Map(
    (ghostSessions ?? []).map((s) => [s.id, s]),
  );

  type GhostGroup = {
    key: string;
    name: string;
    bookingIds: string[];
    count: number;
    earliest: string | null;
    latest: string | null;
    totalPence: number;
  };

  const groupMap = new Map<string, GhostGroup>();
  for (const b of ghostRows ?? []) {
    const raw = (b.trialist_name ?? '').trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    let g = groupMap.get(key);
    if (!g) {
      g = {
        key,
        name: raw,
        bookingIds: [],
        count: 0,
        earliest: null,
        latest: null,
        totalPence: 0,
      };
      groupMap.set(key, g);
    }
    g.bookingIds.push(b.id);
    g.count += 1;
    g.totalPence += b.amount_pence;
    const sess = ghostSessionById.get(b.session_id);
    if (sess) {
      if (!g.earliest || sess.date < g.earliest) g.earliest = sess.date;
      if (!g.latest || sess.date > g.latest) g.latest = sess.date;
    }
  }

  const allGroups = Array.from(groupMap.values()).sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
  const queryTokens = normaliseTokens(ghostQ);
  const ghostGroups = queryTokens.length > 0
    ? allGroups.filter((g) => {
        const nameTokens = normaliseTokens(g.name);
        return queryTokens.every((q) =>
          nameTokens.some((t) => t.includes(q)),
        );
      })
    : allGroups;

  const totalGhosts = ghostRows.length;

  const sortedBookings = (bookings ?? []).slice().sort((a, b) => {
    const dateCmp = b.sessions.date.localeCompare(a.sessions.date);
    if (dateCmp !== 0) return dateCmp;
    return b.sessions.start_time.localeCompare(a.sessions.start_time);
  });
  const bookingsTotal = sortedBookings.length;
  const bookingTotalPages = Math.max(1, Math.ceil(bookingsTotal / BOOKINGS_PAGE_SIZE));
  const pagedBookings = sortedBookings.slice(
    bookingOffset,
    bookingOffset + BOOKINGS_PAGE_SIZE,
  );

  const balancePence = (balance as number) ?? 0;

  return (
    <div className="space-y-6">
      <p>
        <Link href="/admin/parents">
          <ArrowLeft /> Back to parents
        </Link>
      </p>

      <header className="space-y-1">
        <h1 className="text-2xl font-bold">{parent.name}</h1>
        <p className="text-fg-muted">
          {parent.email}
          {parent.phone ? ` - ${parent.phone}` : ''}
        </p>
      </header>

      {sp.success && (
        <p className="p-3 bg-[var(--ok-bg)] border border-[var(--ok-line)] text-[var(--ok-fg)] rounded">
          {sp.success}
        </p>
      )}
      {sp.error && (
        <p className="p-3 bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger-fg)] rounded">
          {sp.error}
        </p>
      )}

      <section className="space-y-3 p-4 border border-line rounded bg-surface">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="text-xl font-bold">Credit balance</h2>
          <p
            className={`text-2xl font-bold ${
              balancePence < 0 ? 'text-[var(--danger-fg)]' : ''
            }`}
          >
            {formatPence(balancePence)}
          </p>
        </div>

        <form action={adjustCredit} className="space-y-3 max-w-md pt-3 border-t border-line">
          <input type="hidden" name="parent_id" value={parent.id} />
          <label className="block">
            <span className="block mb-1 text-sm">Adjustment (£) – use a negative value to deduct</span>
            <input
              type="number"
              name="amount"
              required
              step="0.01"
              className="w-full"
              placeholder="10.00 or -5.00"
            />
          </label>
          <label className="block">
            <span className="block mb-1 text-sm">Note</span>
            <input
              type="text"
              name="note"
              className="w-full"
              placeholder="e.g. Goodwill for cancelled session"
            />
          </label>
          <button type="submit">Adjust credit</button>
        </form>

        {(entries ?? []).length > 0 && (
          <details className="pt-2">
            <summary className="cursor-pointer text-sm text-fg-muted">
              Recent entries ({entries!.length})
            </summary>
            <div className="overflow-x-auto mt-2">
              <table className="text-sm">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Reason</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {(entries ?? []).map((e) => (
                    <tr key={e.id}>
                      <td>{formatDate(e.created_at.slice(0, 10))}</td>
                      <td
                        className={
                          e.amount_pence < 0 ? 'text-[var(--danger-fg)]' : ''
                        }
                      >
                        {e.amount_pence < 0 ? '−' : '+'}
                        {formatPence(Math.abs(e.amount_pence))}
                      </td>
                      <td>{REASON_LABEL[e.reason] ?? e.reason}</td>
                      <td>{e.note ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">Players</h2>
        {(children ?? []).length === 0 ? (
          <p className="text-fg-muted text-sm">No players registered.</p>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>DOB</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(children ?? []).map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.dob ? formatDob(c.dob) : '-'}</td>
                    <td>{c.notes ?? '-'}</td>
                    <td>
                      <DeleteChildButton
                        parentId={parent.id}
                        childId={c.id}
                        childName={c.name}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section id="bookings" className="space-y-2 scroll-mt-4">
        <h2 className="text-xl font-bold">Bookings</h2>
        {bookingsTotal === 0 ? (
          <p className="text-fg-muted text-sm">No bookings yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Status</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {pagedBookings.map((b) => (
                  <tr key={b.id}>
                    <td>{formatDate(b.sessions.date)}</td>
                    <td>{STATUS_LABEL[b.status]}</td>
                    <td>{formatPence(b.amount_pence)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {bookingsTotal > BOOKINGS_PAGE_SIZE && (
              <nav
                aria-label="Bookings pagination"
                className="flex flex-wrap items-center justify-between gap-3 pt-3"
              >
                <p className="text-sm text-fg-muted">
                  Showing {bookingOffset + 1}–{Math.min(bookingOffset + BOOKINGS_PAGE_SIZE, bookingsTotal)} of {bookingsTotal} · Page {bookingPage} of {bookingTotalPages}
                </p>
                <div className="flex gap-2 text-sm font-heading uppercase tracking-wide font-bold">
                  <BookingPageLink
                    parentId={parent.id}
                    ghostQ={ghostQ}
                    page={bookingPage - 1}
                    disabled={bookingPage <= 1}
                    label="← Prev"
                  />
                  <BookingPageLink
                    parentId={parent.id}
                    ghostQ={ghostQ}
                    page={bookingPage + 1}
                    disabled={bookingPage >= bookingTotalPages}
                    label="Next →"
                  />
                </div>
              </nav>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3 p-4 border border-line rounded bg-surface">
        <h2 className="text-xl font-bold">Claim a ghost booking</h2>
        <p className="text-sm text-fg-muted">
          Reassign a historic trialist booking to one of this parent&apos;s players. Past
          attendance and awards stay attached to the booking.
          {typeof totalGhosts === 'number' && (
            <> {totalGhosts} ghost booking{totalGhosts === 1 ? '' : 's'} on file.</>
          )}
        </p>

        <form
          method="get"
          action={`/admin/parents/${parent.id}`}
          className="flex gap-2 max-w-md"
        >
          <input
            type="search"
            name="q"
            defaultValue={ghostQ}
            placeholder="Filter by trialist name"
            className="flex-1 border border-line rounded px-3 py-2"
          />
          <button type="submit">Search</button>
          {ghostQ && (
            <Link href={`/admin/parents/${parent.id}`} className="text-sm self-center">
              Clear
            </Link>
          )}
        </form>

        {(children ?? []).length === 0 ? (
          <p className="text-sm text-fg-muted">
            This parent has no players yet — add one before claiming.
          </p>
        ) : ghostGroups.length === 0 ? (
          <p className="text-sm text-fg-muted">
            {ghostError
              ? `Query error: ${ghostError.message}`
              : ghostQ
              ? `No ghost bookings match "${ghostQ}".`
              : 'No ghost bookings on file.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {ghostGroups.map((g) => (
              <li
                key={g.key}
                className="p-3 border border-line rounded flex flex-wrap items-center gap-3"
              >
                <span className="flex-1 min-w-0">
                  <strong>{g.name}</strong>
                  <span className="text-fg-muted text-sm">
                    {' '}— {g.count} booking{g.count === 1 ? '' : 's'}
                    {g.earliest && g.latest && (
                      <>
                        {' - '}
                        {g.earliest === g.latest
                          ? formatDate(g.earliest)
                          : `${formatDate(g.earliest)} → ${formatDate(g.latest)}`}
                      </>
                    )}
                    {' - '}
                    {formatPence(g.totalPence)}
                  </span>
                </span>
                <form action={claimGhost} className="flex items-center gap-2">
                  <input type="hidden" name="parent_id" value={parent.id} />
                  <input type="hidden" name="booking_ids" value={g.bookingIds.join(',')} />
                  <select name="child_id" required className="text-sm">
                    <option value="">Player…</option>
                    {(children ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="text-sm">
                    Claim all ({g.count})
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// Lowercase, NFKD-normalise (so accented letters collapse to their base form),
// split on anything that isn't a letter or digit. This makes the ghost search
// tolerant of word order, punctuation, non-breaking spaces, em-dashes, and
// other invisible characters that can sneak in via copy-paste.
function normaliseTokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function BookingPageLink({
  parentId,
  ghostQ,
  page,
  disabled,
  label,
}: {
  parentId: string;
  ghostQ: string;
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
  const params = new URLSearchParams();
  if (ghostQ) params.set('q', ghostQ);
  if (page > 1) params.set('bp', String(page));
  const qs = params.toString();
  const href = `/admin/parents/${parentId}${qs ? `?${qs}` : ''}#bookings`;
  return (
    <Link
      href={href}
      className={`${cls} bg-surface! border-line text-fg! hover:bg-surface-2!`}
    >
      {label}
    </Link>
  );
}
