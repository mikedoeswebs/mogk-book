import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatDateLong, formatTime } from '@/lib/format';
import { ArrowLeft } from '@/lib/ui/Icon';
import { SubmitButton } from '@/lib/ui/SubmitButton';
import type { ClubEvent, EventRsvp, Parent } from '@/lib/db/types';
import { EventFields } from '../EventFields';
import { updateEvent } from '../actions';
import { DeleteEventButton } from './DeleteEventButton';

type Reply = EventRsvp & { parents: Pick<Parent, 'id' | 'name' | 'email' | 'phone'> | null };

export default async function AdminEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const supabase = createSupabaseAdminClient();

  const [{ data: event }, { data: replyRows }] = await Promise.all([
    supabase.from('events').select('*').eq('id', id).maybeSingle<ClubEvent>(),
    supabase
      .from('event_rsvps')
      .select('*, parents(id, name, email, phone)')
      .eq('event_id', id)
      .returns<Reply[]>(),
  ]);
  if (!event) notFound();

  const replies = (replyRows ?? []).sort((a, b) =>
    (a.parents?.name ?? '').localeCompare(b.parents?.name ?? ''),
  );
  const coming = replies.filter((r) => r.adults + r.children > 0);
  const declined = replies.length - coming.length;
  const adults = coming.reduce((s, r) => s + r.adults, 0);
  const children = coming.reduce((s, r) => s + r.children, 0);

  return (
    <div className="space-y-6">
      <p><Link href="/admin/events"><ArrowLeft /> Back to events</Link></p>
      <div>
        <h1 className="text-2xl font-bold">{event.title}</h1>
        <p className="text-fg-muted">
          {formatDateLong(event.date)}, {formatTime(event.start_time)}
          {event.end_time ? `–${formatTime(event.end_time)}` : ''} · {event.location}
          {event.rsvp_by ? ` · Reply by ${formatDateLong(event.rsvp_by)}` : ''}
          {event.capacity ? ` · Capacity ${event.capacity}` : ''}
        </p>
      </div>
      {sp.error && (
        <p className="p-3 bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger-fg)] rounded">{sp.error}</p>
      )}
      {sp.saved && (
        <p className="p-3 bg-[var(--ok-bg)] border border-[var(--ok-line)] text-[var(--ok-fg)] rounded">Saved.</p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">
          {adults + children}{event.capacity ? ` / ${event.capacity}` : ''} attending ({adults} adult{adults === 1 ? '' : 's'}, {children} child{children === 1 ? '' : 'ren'})
        </h2>
        <p className="text-sm text-fg-muted">
          {coming.length} famil{coming.length === 1 ? 'y' : 'ies'} coming, {declined} can&apos;t make it.
        </p>
        {replies.length > 0 && (
          <div className="overflow-x-auto"><table>
            <thead>
              <tr>
                <th>Parent</th>
                <th>Contact</th>
                <th>Adults</th>
                <th>Children</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {replies.map((r) => (
                <tr key={r.parent_id} className={r.adults + r.children === 0 ? 'opacity-60' : ''}>
                  <td>
                    {r.parents ? <Link href={`/admin/parents/${r.parents.id}`}>{r.parents.name}</Link> : 'Deleted parent'}
                  </td>
                  <td className="text-sm">
                    {r.parents?.email}
                    {r.parents?.phone && <><br />{r.parents.phone}</>}
                  </td>
                  {r.adults + r.children === 0 ? (
                    <td colSpan={2} className="text-sm">Can&apos;t make it</td>
                  ) : (
                    <>
                      <td>{r.adults}</td>
                      <td>{r.children}</td>
                    </>
                  )}
                  <td className="text-sm whitespace-pre-line">{r.notes}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </section>

      <section className="space-y-3 max-w-md">
        <h2 className="text-lg font-bold">Edit event</h2>
        <form action={updateEvent} className="space-y-3">
          <input type="hidden" name="id" value={event.id} />
          <EventFields event={event} />
          <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
        </form>
        <div className="pt-4 border-t border-line">
          <DeleteEventButton id={event.id} title={event.title} replies={replies.length} />
        </div>
      </section>
    </div>
  );
}
