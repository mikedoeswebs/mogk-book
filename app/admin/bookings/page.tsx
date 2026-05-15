import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatDate, formatTime, formatPence } from '@/lib/format';
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

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; success?: string; error?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from('bookings')
    .select('*, sessions(*), children(*), parents(*)')
    .order('created_at', { ascending: false })
    .limit(500);

  if (sp.status && sp.status !== 'all') {
    query = query.eq('status', sp.status);
  }

  const { data } = await query.returns<Row[]>();
  const rows = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bookings</h1>
        <div className="flex gap-3 items-center">
          <Link href="/admin/bookings/new" className="text-sm">+ New booking</Link>
          <Link href="/admin/bookings/export" className="text-sm">Export CSV</Link>
        </div>
      </div>

      {sp.success && (
        <p className="p-3 bg-[var(--ok-bg)] border border-[var(--ok-line)] text-[var(--ok-fg)] rounded">{sp.success}</p>
      )}
      {sp.error && (
        <p className="p-3 bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger-fg)] rounded">{sp.error}</p>
      )}

      <nav className="flex gap-3 text-sm">
        <Link href="/admin/bookings">All</Link>
        <Link href="/admin/bookings?status=active">Confirmed</Link>
        <Link href="/admin/bookings?status=awaiting_approval">Awaiting approval</Link>
        <Link href="/admin/bookings?status=pending_payment">Pending payment</Link>
        <Link href="/admin/bookings?status=cancelled">Cancelled</Link>
      </nav>

      {rows.length === 0 ? (
        <p>No bookings match.</p>
      ) : (
        <div className="overflow-x-auto"><table>
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
                ? <span className="text-xs text-fg-muted">Ghost trialist</span>
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
                  <td>
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
                  <td className="text-sm">{new Date(b.created_at).toLocaleString('en-GB')}</td>
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
                          <button type="submit" className="text-[var(--danger-fg)] underline border-0 bg-transparent p-0">
                            Cancel
                          </button>
                        </form>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      )}
    </div>
  );
}
