import { requireParent } from '@/lib/auth/require-parent';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { rsvpOpen } from '@/lib/booking/rules';
import { formatDateLong, formatDateWeekday, formatTime, londonToday } from '@/lib/format';
import { SubmitButton } from '@/lib/ui/SubmitButton';
import type { ClubEvent, EventRsvp } from '@/lib/db/types';
import { saveRsvp } from './actions';

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const parent = await requireParent();
  const sp = await searchParams;
  const supabase = await createSupabaseServerClient();
  const today = londonToday();

  const [{ data: events }, { data: rsvps }] = await Promise.all([
    supabase
      .from('events')
      .select('*')
      .gte('date', today)
      .order('date', { ascending: true })
      .returns<ClubEvent[]>(),
    supabase.from('event_rsvps').select('*').eq('parent_id', parent.id).returns<EventRsvp[]>(),
  ]);
  const byEvent = new Map((rsvps ?? []).map((r) => [r.event_id, r]));

  const limited = (events ?? []).filter((e) => e.capacity).map((e) => e.id);
  const taken = new Map<string, number>();
  if (limited.length > 0) {
    const { data } = await supabase.rpc('get_event_places_taken', { p_event_ids: limited });
    for (const row of (data ?? []) as { event_id: string; taken: number }[]) taken.set(row.event_id, row.taken);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Events</h1>
      {sp.error && (
        <p className="p-3 bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger-fg)] rounded">{sp.error}</p>
      )}
      {(events ?? []).length === 0 && <p className="text-fg-muted">No upcoming events. We&apos;ll let you know when there is one.</p>}

      {(events ?? []).map((e) => {
        const rsvp = byEvent.get(e.id);
        const open = rsvpOpen(e, today);
        const coming = rsvp && rsvp.adults + rsvp.children > 0;
        // Places left for others; a parent's own places are theirs to change.
        const left = e.capacity === null ? null : Math.max(e.capacity - (taken.get(e.id) ?? 0), 0);
        const full = left === 0 && !coming;
        return (
          <section key={e.id} id={`event-${e.id}`} className="p-4 border border-line rounded bg-surface space-y-3 max-w-2xl scroll-mt-4">
            <div>
              <h2 className="text-xl font-bold">{e.title}</h2>
              <p>
                {formatDateWeekday(e.date)}, {formatTime(e.start_time)}
                {e.end_time ? `–${formatTime(e.end_time)}` : ''}
              </p>
              <p className="text-sm text-fg-muted">{e.location}</p>
              {left !== null && open && !full && (
                <p className="text-sm mt-1">{left} place{left === 1 ? '' : 's'} left</p>
              )}
            </div>
            {e.description && <p className="whitespace-pre-line">{e.description}</p>}

            {sp.saved === e.id && (
              <p className="p-3 bg-[var(--ok-bg)] border border-[var(--ok-line)] text-[var(--ok-fg)] rounded">Thanks, we&apos;ve got your reply.</p>
            )}
            {rsvp && (
              <p className="font-bold">
                {coming
                  ? `You're coming: ${rsvp.adults} adult${rsvp.adults === 1 ? '' : 's'}, ${rsvp.children} child${rsvp.children === 1 ? '' : 'ren'}.`
                  : "You've told us you can't make it."}
              </p>
            )}

            {open && full ? (
              <p className="text-sm text-fg-muted">This event is full. Please contact us if you&apos;d like to be told if places come up.</p>
            ) : open ? (
              <form action={saveRsvp} className="space-y-3 pt-3 border-t border-line">
                <input type="hidden" name="event_id" value={e.id} />
                <p className="text-sm text-fg-muted">
                  {rsvp ? 'Change your reply' : 'Let us know how many of you are coming'}
                  {e.rsvp_by ? ` by ${formatDateLong(e.rsvp_by)}` : ''}.
                </p>
                <div className="flex gap-3 max-w-sm">
                  <label className="block flex-1">
                    <span className="block mb-1">Adults</span>
                    <input type="number" name="adults" min={0} max={20} required defaultValue={coming ? rsvp.adults : 1} className="w-full" />
                  </label>
                  <label className="block flex-1">
                    <span className="block mb-1">Children (incl. players)</span>
                    <input type="number" name="children" min={0} max={20} required defaultValue={coming ? rsvp.children : 1} className="w-full" />
                  </label>
                </div>
                <label className="block">
                  <span className="block mb-1">Anything we should know? (optional)</span>
                  <textarea name="notes" rows={2} maxLength={1000} defaultValue={rsvp?.notes ?? undefined} className="w-full" />
                </label>
                <div className="flex flex-wrap gap-3">
                  <SubmitButton pendingLabel="Saving…">{coming ? 'Update reply' : "We're coming"}</SubmitButton>
                  {!(rsvp && !coming) && (
                    <SubmitButton
                      name="decline"
                      value="1"
                      formNoValidate
                      className="bg-transparent border border-line text-fg hover:bg-surface-2 hover:border-fg-muted"
                    >
                      Can&apos;t make it
                    </SubmitButton>
                  )}
                </div>
              </form>
            ) : (
              <p className="text-sm text-fg-muted">Replies have closed. Please contact us if your plans change.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
