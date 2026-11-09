import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatDate, formatTime, londonToday } from '@/lib/format';
import { SubmitButton } from '@/lib/ui/SubmitButton';
import type { ClubEvent, EventRsvp } from '@/lib/db/types';
import { EventFields } from './EventFields';
import { createEvent } from './actions';

type Row = ClubEvent & { event_rsvps: Pick<EventRsvp, 'adults' | 'children'>[] };

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const { data } = await createSupabaseAdminClient()
    .from('events')
    .select('*, event_rsvps(adults, children)')
    .order('date', { ascending: false })
    .returns<Row[]>();

  const today = londonToday();
  const events = data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Events</h1>
      {sp.error && (
        <p className="p-3 bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger-fg)] rounded">{sp.error}</p>
      )}

      {events.length === 0 ? (
        <p className="text-fg-muted">No events yet.</p>
      ) : (
        <div className="overflow-x-auto"><table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Date</th>
              <th>Families</th>
              <th>Adults</th>
              <th>Children</th>
              <th>Places</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => {
              const coming = e.event_rsvps.filter((r) => r.adults + r.children > 0);
              return (
                <tr key={e.id} className={e.date < today ? 'opacity-60' : ''}>
                  <td><Link href={`/admin/events/${e.id}`}>{e.title}</Link></td>
                  <td>{formatDate(e.date)} {formatTime(e.start_time)}</td>
                  <td>{coming.length}</td>
                  <td>{coming.reduce((s, r) => s + r.adults, 0)}</td>
                  <td>{coming.reduce((s, r) => s + r.children, 0)}</td>
                  <td>
                    {coming.reduce((s, r) => s + r.adults + r.children, 0)}
                    {e.capacity ? ` / ${e.capacity}` : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      )}

      <details className="border border-line rounded p-4 max-w-md" open={events.length === 0 || !!sp.error}>
        <summary className="cursor-pointer font-heading font-bold uppercase">New event</summary>
        <form action={createEvent} className="space-y-3 mt-3">
          <EventFields />
          <SubmitButton pendingLabel="Creating…">Create event</SubmitButton>
        </form>
      </details>
    </div>
  );
}
