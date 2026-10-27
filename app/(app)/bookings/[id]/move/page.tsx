import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireParent } from '@/lib/auth/require-parent';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isParentMoveTarget, parentCanMoveBooking, playerTooOld } from '@/lib/booking/rules';
import { formatDate, formatTime } from '@/lib/format';
import { ArrowLeft } from '@/lib/ui/Icon';
import { SubmitButton } from '@/lib/ui/SubmitButton';
import type { Booking, Child, Session } from '@/lib/db/types';
import { moveBooking } from '../../actions';

type Row = Booking & { sessions: Session; children: Child };

export default async function MoveBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const parent = await requireParent();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createSupabaseServerClient();

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, sessions!session_id(*), children(*)')
    .eq('id', id)
    .eq('parent_id', parent.id)
    .maybeSingle<Row>();
  if (!booking) notFound();

  const movable = parentCanMoveBooking(booking, booking.sessions);
  const todayISO = new Date().toISOString().slice(0, 10);

  const [{ data: sessions }, { data: childBookings }] = movable
    ? await Promise.all([
        supabase
          .from('sessions')
          .select('*')
          .eq('status', 'open')
          .eq('price_pence', booking.sessions.price_pence)
          .gte('date', todayISO)
          .order('date', { ascending: true })
          .order('start_time', { ascending: true })
          .returns<Session[]>(),
        supabase
          .from('bookings')
          .select('session_id')
          .eq('child_id', booking.child_id!)
          .in('status', ['pending_payment', 'awaiting_approval', 'active'])
          .returns<{ session_id: string }[]>(),
      ])
    : [{ data: [] as Session[] }, { data: [] }];

  const alreadyBooked = new Set((childBookings ?? []).map((b) => b.session_id));
  const targets = (sessions ?? []).filter(
    (s) =>
      isParentMoveTarget(booking.sessions, s) &&
      !alreadyBooked.has(s.id) &&
      !playerTooOld(booking.children, s),
  );

  const remaining = new Map<string, number>();
  if (targets.length > 0) {
    const { data: availability } = await supabase.rpc('get_session_availability', {
      p_session_ids: targets.map((s) => s.id),
    });
    for (const a of (availability ?? []) as { session_id: string; remaining: number }[]) {
      remaining.set(a.session_id, a.remaining);
    }
  }

  return (
    <div className="space-y-4 max-w-md">
      <p><Link href="/bookings"><ArrowLeft /> My bookings</Link></p>
      <h1 className="text-2xl font-bold">Move booking</h1>
      <p>
        {booking.children.name} · {formatDate(booking.sessions.date)}{' '}
        {formatTime(booking.sessions.start_time)}
        {booking.sessions.age_group ? ` | ${booking.sessions.age_group}` : ''}
      </p>

      {sp.error && (
        <p className="p-3 bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger-fg)] rounded">{sp.error}</p>
      )}

      {!movable ? (
        <p>
          This booking can&apos;t be moved. Bookings can be moved up to 24 hours before the
          session starts.
        </p>
      ) : targets.length === 0 ? (
        <p>There are no other sessions at the same price to move to right now.</p>
      ) : (
        <form action={moveBooking} className="space-y-3">
          <p className="text-sm text-fg-muted">
            Move this place to another session at the same price, at least 24 hours away.
            Nothing extra to pay and no booking fee.
          </p>
          <input type="hidden" name="id" value={booking.id} />
          <label className="block">
            <span className="block mb-1">New session</span>
            <select name="session_id" required defaultValue="" className="w-full">
              <option value="">Choose a session…</option>
              {targets.map((s) => {
                const left = remaining.get(s.id) ?? s.capacity;
                return (
                  <option key={s.id} value={s.id} disabled={left <= 0}>
                    {formatDate(s.date)} {formatTime(s.start_time)}
                    {s.age_group ? ` | ${s.age_group}` : ''}
                    {' - '}
                    {left <= 0 ? 'Full' : `${left} left`}
                  </option>
                );
              })}
            </select>
          </label>
          <SubmitButton pendingLabel="Moving…">Move booking</SubmitButton>
        </form>
      )}
    </div>
  );
}
