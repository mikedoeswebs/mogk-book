import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { ArrowLeft } from '@/lib/ui/Icon';
import type { Coach, Session } from '@/lib/db/types';
import { updateSession, cancelSession, reopenSession, deleteSession } from './actions';

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
  const [{ data: session }, { data: coaches }, { data: linked }, { count: bookingsCount }] = await Promise.all([
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
      .select('id', { count: 'exact', head: true })
      .eq('session_id', id),
  ]);

  if (!session) notFound();

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
        <button type="submit">Save changes</button>
      </form>

      {session.status === 'open' && (
        <form action={cancelSession} className="pt-4 border-t border-line">
          <input type="hidden" name="id" value={session.id} />
          <p className="text-sm text-fg-muted mb-2">
            Cancelling closes the session to new bookings. Existing bookings are not refunded
            automatically - handle those manually.
          </p>
          <button type="submit">Cancel this session</button>
        </form>
      )}

      {session.status === 'cancelled' && (
        <form action={reopenSession} className="pt-4 border-t border-line">
          <input type="hidden" name="id" value={session.id} />
          <p className="text-sm text-fg-muted mb-2">
            This session is currently cancelled. Reopening puts it back into the &quot;open&quot;
            state so parents can book it again.
          </p>
          <button type="submit">Reopen this session</button>
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
        <button
          type="submit"
          className="bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger-fg)] hover:bg-[var(--danger-line)]"
        >
          Delete this session permanently
        </button>
      </form>
    </div>
  );
}
