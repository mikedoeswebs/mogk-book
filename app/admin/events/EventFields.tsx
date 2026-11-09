import type { ClubEvent } from '@/lib/db/types';

/** Shared by the create and edit forms. */
export function EventFields({ event }: { event?: ClubEvent }) {
  return (
    <>
      <label className="block">
        <span className="block mb-1">Title</span>
        <input type="text" name="title" required defaultValue={event?.title} placeholder="e.g. Christmas Awards Night" className="w-full" />
      </label>
      <label className="block">
        <span className="block mb-1">Date</span>
        <input type="date" name="date" required defaultValue={event?.date} className="w-full" />
      </label>
      <div className="flex gap-3">
        <label className="block flex-1">
          <span className="block mb-1">Start</span>
          <input type="time" name="start_time" required defaultValue={event?.start_time.slice(0, 5) ?? '18:00'} className="w-full" />
        </label>
        <label className="block flex-1">
          <span className="block mb-1">End (optional)</span>
          <input type="time" name="end_time" defaultValue={event?.end_time?.slice(0, 5)} className="w-full" />
        </label>
      </div>
      <label className="block">
        <span className="block mb-1">Location</span>
        <input type="text" name="location" required defaultValue={event?.location} className="w-full" />
      </label>
      <label className="block">
        <span className="block mb-1">Capacity (optional)</span>
        <input type="number" name="capacity" min={1} defaultValue={event?.capacity ?? undefined} className="w-full" />
        <span className="block text-sm text-fg-muted mt-1">Total people, adults and children. Leave empty for no limit.</span>
      </label>
      <label className="block">
        <span className="block mb-1">Reply by (optional)</span>
        <input type="date" name="rsvp_by" defaultValue={event?.rsvp_by ?? undefined} className="w-full" />
        <span className="block text-sm text-fg-muted mt-1">Parents can reply or change their numbers up to and including this day.</span>
      </label>
      <label className="block">
        <span className="block mb-1">Details (shown to parents)</span>
        <textarea name="description" rows={4} defaultValue={event?.description ?? undefined} className="w-full" />
      </label>
    </>
  );
}
