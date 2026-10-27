import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireParent } from '@/lib/auth/require-parent';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sessionIsPast } from '@/lib/booking/rules';
import { formatDate } from '@/lib/format';
import { ArrowLeft } from '@/lib/ui/Icon';
import { SubmitButton } from '@/lib/ui/SubmitButton';
import type { Booking, Child, Session } from '@/lib/db/types';
import { updateChild } from '../actions';
import { MedicalFields } from '../MedicalFields';

const MILESTONES = [10, 25, 50];

type BookingRow = Pick<Booking, 'id' | 'attended'> & {
  sessions: Pick<
    Session,
    'date' | 'starts_at' | 'age_group' | 'captain_booking_id' | 'player_of_week_booking_id'
  >;
};

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const parent = await requireParent();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createSupabaseServerClient();

  const [{ data: child }, { data: bookings }] = await Promise.all([
    supabase
      .from('children')
      .select('*')
      .eq('id', id)
      .eq('parent_id', parent.id)
      .maybeSingle<Child>(),
    supabase
      .from('bookings')
      .select(
        'id, attended, sessions!session_id(date, starts_at, age_group, captain_booking_id, player_of_week_booking_id)',
      )
      .eq('child_id', id)
      .eq('parent_id', parent.id)
      .eq('status', 'active')
      .returns<BookingRow[]>(),
  ]);
  if (!child) notFound();

  // Same rule as the lapsed-players list: a past, confirmed booking counts
  // unless the register marks the player as missed.
  const attended = (bookings ?? [])
    .filter((b) => b.sessions && sessionIsPast(b.sessions) && b.attended !== false)
    .sort((a, b) => b.sessions.date.localeCompare(a.sessions.date));
  const count = attended.length;
  const earned = MILESTONES.filter((m) => count >= m);
  const next = MILESTONES.find((m) => count < m);

  const awards = attended.flatMap((b) => [
    ...(b.sessions.captain_booking_id === b.id ? [{ date: b.sessions.date, award: 'Captain' }] : []),
    ...(b.sessions.player_of_week_booking_id === b.id
      ? [{ date: b.sessions.date, award: 'Player of the week' }]
      : []),
  ]);

  return (
    <div className="space-y-6">
      <p><Link href="/children"><ArrowLeft /> My players</Link></p>
      <h1 className="text-2xl font-bold">{child.name}</h1>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">Sessions</h2>
        <p>
          <strong className="text-2xl">{count}</strong>{' '}
          session{count === 1 ? '' : 's'} attended
          {attended[0] && (
            <span className="text-sm text-fg-muted"> · last on {formatDate(attended[0].sessions.date)}</span>
          )}
        </p>
        <ul className="flex flex-wrap gap-2">
          {MILESTONES.map((m) => (
            <li
              key={m}
              className={`px-3 py-1.5 rounded border text-sm font-heading uppercase tracking-wide font-bold ${
                earned.includes(m)
                  ? 'bg-accent text-accent-ink border-accent'
                  : 'bg-surface border-line text-fg-muted opacity-50'
              }`}
            >
              {m} sessions
            </li>
          ))}
        </ul>
        {next && (
          <p className="text-sm text-fg-muted">
            {next - count} more to reach the {next}-session badge.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">Awards</h2>
        {awards.length === 0 ? (
          <p className="text-fg-muted">No captain or player of the week awards yet.</p>
        ) : (
          <div className="overflow-x-auto"><table>
            <thead>
              <tr><th>Date</th><th>Award</th></tr>
            </thead>
            <tbody>
              {awards.map((a) => (
                <tr key={`${a.date}-${a.award}`}>
                  <td>{formatDate(a.date)}</td>
                  <td>{a.award}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </section>

      <section className="space-y-2 pt-4 border-t border-line">
        <h2 className="text-xl font-bold">Details</h2>
        {sp.saved && (
          <p className="p-3 bg-[var(--ok-bg)] border border-[var(--ok-line)] text-[var(--ok-fg)] rounded">Saved.</p>
        )}
        {sp.error && (
          <p className="p-3 bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger-fg)] rounded">{sp.error}</p>
        )}
        <form action={updateChild} className="space-y-3 max-w-md">
          <input type="hidden" name="id" value={child.id} />
          <label className="block">
            <span className="block mb-1">Name</span>
            <input type="text" name="name" required defaultValue={child.name} className="w-full" />
          </label>
          <label className="block">
            <span className="block mb-1">Date of birth</span>
            <input type="date" name="dob" required defaultValue={child.dob ?? ''} className="w-full" />
          </label>
          <MedicalFields notes={child.notes} consentAt={child.medical_consent_at} />
          <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
        </form>
      </section>
    </div>
  );
}
