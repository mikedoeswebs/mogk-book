import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { ArrowLeft } from '@/lib/ui/Icon';
import { SubmitButton } from '@/lib/ui/SubmitButton';
import type { Booking, Coach, Session } from '@/lib/db/types';
import { updateSession, cancelSession, reopenSession, deleteSession } from './actions';

type SessionBookingRow = {
  id: string;
  is_ghost: boolean;
  trialist_name: string | null;
  status: Booking['status'];
  children: { name: string } | null;
  parents: { name: string } | null;
};

const STATUS_LABEL: Record<Booking['status'], string> = {
  pending_payment: 'Pending payment',
  awaiting_approval: 'Awaiting approval',
  active: 'Confirmed',
  cancelled: 'Cancelled',
  abandoned: 'Abandoned',
};

const STATUS_ORDER: Record<Booking['status'], number> = {
  active: 0,
  awaiting_approval: 1,
  pending_payment: 2,
  cancelled: 3,
  abandoned: 4,
};

export default async function EditSessionPage({
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
  const [{ data: session }, { data: coaches }, { data: linked }, { data: sessionBookings }] = await Promise.all([
    supabase.from('sessions').select('*').eq('id', id).maybeSingle<Session>(),
    supabase
      .from('coaches')
      .select('*')
      .eq('active', true)
      .order('name', { ascending: true })
      .returns<Coach[]>(),
    supabase
      .from('session_coaches')
      .select('coach_id')
      .eq('session_id', id)
      .returns<{ coach_id: string }[]>(),
    supabase
      .from('bookings')
      .select('id, is_ghost, trialist_name, status, children(name), parents(name)')
      .eq('session_id', id)
      .returns<SessionBookingRow[]>(),
  ]);

  if (!session) notFound();

  function playerName(b: SessionBookingRow): string {
    if (b.is_ghost) return b.trialist_name ?? 'Trialist';
    return b.children?.name ?? 'Unknown player';
  }

  const sortedBookings = (sessionBookings ?? []).slice().sort((a, b) => {
    const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (s !== 0) return s;
    return playerName(a).localeCompare(playerName(b));
  });
  const bookingsCount = sortedBookings.length;

  const linkedSet = new Set((linked ?? []).map((r) => r.coach_id));

  // Include archived coaches that are still linked so the admin can see them.
  const { data: archivedLinked } = await supabase
    .from('coaches')
    .select('*')
    .in('id', [...linkedSet])
    .eq('active', false)
    .returns<Coach[]>();
  const allCoaches = [...(coaches ?? []), ...(archivedLinked ?? [])];

  return (
    <div className="space-y-4">
      <p><Link href="/admin/sessions"><ArrowLeft /> Back to sessions</Link></p>
      <h1 className="text-2xl font-bold">Edit session</h1>
      {sp.error && (
        <p className="p-3 bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger-fg)] rounded">{sp.error}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
      <form action={updateSession} className="space-y-3 max-w-md">
        <input type="hidden" name="id" value={session.id} />
        <label className="block">
          <span className="block mb-1">Date</span>
          <input type="date" name="date" required defaultValue={session.date} className="w-full" />
        </label>
        <div className="flex gap-3">
          <label className="block flex-1">
            <span className="block mb-1">Start</span>
            <input
              type="time"
              name="start_time"
              required
              defaultValue={session.start_time.slice(0, 5)}
              className="w-full"
            />
          </label>
          <label className="block flex-1">
            <span className="block mb-1">End</span>
            <input
              type="time"
              name="end_time"
              required
              defaultValue={session.end_time.slice(0, 5)}
              className="w-full"
            />
          </label>
        </div>
        <fieldset className="border border-line rounded p-3">
          <legend className="px-1 text-sm text-fg-muted">Coaches</legend>
          {allCoaches.length === 0 ? (
            <p className="text-sm text-fg-muted">
              No coaches yet. <Link href="/admin/coaches/new">Add one</Link> first.
            </p>
          ) : (
            <ul className="space-y-1">
              {allCoaches.map((c) => (
                <li key={c.id}>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="coach_ids"
                      value={c.id}
                      defaultChecked={linkedSet.has(c.id)}
                    />
                    <span>
                      {c.name}
                      {!c.active && <span className="text-fg-muted text-xs"> (archived)</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
        <label className="block">
          <span className="block mb-1">Group</span>
          <input
            type="text"
            name="age_group"
            defaultValue={session.age_group ?? ''}
            className="w-full"
          />
        </label>
        <div className="flex gap-3">
          <label className="block flex-1">
            <span className="block mb-1">Capacity</span>
            <input
              type="number"
              name="capacity"
              min={1}
              required
              defaultValue={session.capacity}
              className="w-full"
            />
          </label>
          <label className="block flex-1">
            <span className="block mb-1">Price (£)</span>
            <input
              type="number"
              name="price"
              min={0}
              step="0.01"
              required
              defaultValue={(session.price_pence / 100).toFixed(2)}
              className="w-full"
            />
          </label>
        </div>
        <label className="block">
          <span className="block mb-1">Notes (shown to parents)</span>
          <textarea name="notes" rows={3} defaultValue={session.notes ?? ''} className="w-full" />
        </label>
        <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
      </form>

      {session.status === 'open' && (
        <form action={cancelSession} className="pt-4 border-t border-line">
          <input type="hidden" name="id" value={session.id} />
          <p className="text-sm text-fg-muted mb-2">
            Cancelling closes the session to new bookings. Existing bookings are not refunded
            automatically - handle those manually.
          </p>
          <SubmitButton pendingLabel="Cancelling…">Cancel this session</SubmitButton>
        </form>
      )}

      {session.status === 'cancelled' && (
        <form action={reopenSession} className="pt-4 border-t border-line">
          <input type="hidden" name="id" value={session.id} />
          <p className="text-sm text-fg-muted mb-2">
            This session is currently cancelled. Reopening puts it back into the &quot;open&quot;
            state so parents can book it again.
          </p>
          <SubmitButton pendingLabel="Reopening…">Reopen this session</SubmitButton>
        </form>
      )}

      <form
        action={deleteSession}
        className="pt-6 mt-2 border-t border-[var(--danger-line)] max-w-md space-y-2"
      >
        <input type="hidden" name="id" value={session.id} />
        <h2 className="text-lg font-bold text-[var(--danger-fg)]">Danger zone</h2>
        <p className="text-sm text-fg-muted">
          Permanently delete this session{' '}
          {bookingsCount && bookingsCount > 0 ? (
            <>
              <strong className="text-[var(--danger-fg)]">
                and its {bookingsCount} booking{bookingsCount === 1 ? '' : 's'}
              </strong>
              .
            </>
          ) : (
            <>(no bookings attached).</>
          )}{' '}
          Coach links are cleaned up automatically. Credit-ledger entries that reference deleted
          bookings stay in place but unlink. This cannot be undone.
        </p>
        <label className="block">
          <span className="block mb-1 text-sm">
            Type <code className="text-[var(--danger-fg)]">DELETE</code> to confirm
          </span>
          <input
            type="text"
            name="confirm"
            required
            pattern="DELETE"
            placeholder="DELETE"
            className="w-full"
          />
        </label>
        <SubmitButton
          className="bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger-fg)] hover:bg-[var(--danger-line)]"
          pendingLabel="Deleting…"
        >
          Delete this session permanently
        </SubmitButton>
      </form>
        </div>

        <aside className="space-y-3">
          <div className="p-4 border border-line rounded bg-surface space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold">Bookings</h2>
              <span className="text-sm text-fg-muted">
                {bookingsCount}/{session.capacity}
              </span>
            </div>
            {bookingsCount === 0 ? (
              <p className="text-sm text-fg-muted">No bookings on this session yet.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {sortedBookings.map((b) => (
                  <li key={b.id} className="py-2 first:pt-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium truncate">
                        {playerName(b)}
                        {b.is_ghost && (
                          <span className="ml-1.5 text-xs text-fg-muted/70">(ghost)</span>
                        )}
                      </span>
                      <Link
                        href={`/admin/bookings/${b.id}/edit`}
                        className="text-xs whitespace-nowrap"
                      >
                        Edit
                      </Link>
                    </div>
                    <div className="text-xs text-fg-muted flex flex-wrap gap-x-2">
                      <span>
                        {b.is_ghost ? 'Ghost booking' : (b.parents?.name ?? 'Unknown parent')}
                      </span>
                      {b.status !== 'active' && (
                        <span
                          className={
                            b.status === 'cancelled' || b.status === 'abandoned'
                              ? 'text-[var(--danger-fg)]'
                              : 'text-[var(--warn-fg)]'
                          }
                        >
                          · {STATUS_LABEL[b.status]}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="pt-2 border-t border-line text-xs">
              <Link href={`/admin/bookings/new?session=${session.id}`}>+ Add booking</Link>
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
