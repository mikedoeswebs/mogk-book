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

export default async function AdminParentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; error?: string; success?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const ghostQ = (sp.q ?? '').trim();

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
    supabase
      .from('bookings')
      .select('*, sessions(*)')
      .eq('parent_id', id)
      .order('created_at', { ascending: false })
      .limit(20)
      .returns<(Booking & { sessions: Session })[]>(),
  ]);

  if (!parent) notFound();

  let ghostQuery = supabase
    .from('bookings')
    .select('*, sessions(*)')
    .eq('is_ghost', true)
    .order('created_at', { ascending: false })
    .limit(30);
  if (ghostQ) {
    ghostQuery = ghostQuery.ilike('trialist_name', `%${ghostQ}%`);
  }
  const { data: ghosts } = await ghostQuery.returns<
    (Booking & { sessions: Session })[]
  >();

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
          {parent.phone ? ` · ${parent.phone}` : ''}
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
                </tr>
              </thead>
              <tbody>
                {(children ?? []).map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.dob ? formatDob(c.dob) : '-'}</td>
                    <td>{c.notes ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">Recent bookings</h2>
        {(bookings ?? []).length === 0 ? (
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
                {(bookings ?? []).map((b) => (
                  <tr key={b.id}>
                    <td>{formatDate(b.sessions.date)}</td>
                    <td>{STATUS_LABEL[b.status]}</td>
                    <td>{formatPence(b.amount_pence)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3 p-4 border border-line rounded bg-surface">
        <h2 className="text-xl font-bold">Claim a ghost booking</h2>
        <p className="text-sm text-fg-muted">
          Reassign a historic trialist booking to one of this parent&apos;s players. Past
          attendance and awards stay attached to the booking.
        </p>

        <form className="flex gap-2 max-w-md">
          <input
            type="search"
            name="q"
            defaultValue={ghostQ}
            placeholder="Search trialist name"
            className="flex-1"
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
        ) : !ghosts || ghosts.length === 0 ? (
          <p className="text-sm text-fg-muted">
            {ghostQ ? 'No ghost bookings match.' : 'Enter a trialist name to search.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {ghosts.map((g) => (
              <li
                key={g.id}
                className="p-3 border border-line rounded flex flex-wrap items-center gap-3"
              >
                <span className="flex-1 min-w-0">
                  <strong>{g.trialist_name}</strong>
                  <span className="text-fg-muted text-sm">
                    {' '}— {formatDate(g.sessions.date)}
                    {g.sessions.age_group ? ` · ${g.sessions.age_group}` : ''}
                    {' · '}
                    {formatPence(g.amount_pence)}
                  </span>
                </span>
                <form action={claimGhost} className="flex items-center gap-2">
                  <input type="hidden" name="parent_id" value={parent.id} />
                  <input type="hidden" name="booking_id" value={g.id} />
                  <select name="child_id" required className="text-sm">
                    <option value="">Player…</option>
                    {(children ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="text-sm">Claim</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
