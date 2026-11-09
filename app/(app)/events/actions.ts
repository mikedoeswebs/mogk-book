'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireParent } from '@/lib/auth/require-parent';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const MAX_GUESTS = 20;

function count(v: FormDataEntryValue | null): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= MAX_GUESTS ? n : null;
}

export async function saveRsvp(formData: FormData) {
  await requireParent();
  const eventId = String(formData.get('event_id') ?? '');
  const decline = formData.get('decline') === '1';
  const adults = decline ? 0 : count(formData.get('adults'));
  const children = decline ? 0 : count(formData.get('children'));
  const notes = decline ? null : String(formData.get('notes') ?? '').trim().slice(0, 1000) || null;

  const fail = (msg: string) => redirect(`/events?error=${encodeURIComponent(msg)}#event-${eventId}`);
  if (adults === null || children === null) fail(`Numbers must be between 0 and ${MAX_GUESTS}`);

  // Capacity and the reply-by date are checked inside the function, under a
  // lock on the event, so they hold even when parents reply at the same time.
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('save_event_rsvp', {
    p_event_id: eventId,
    p_adults: adults,
    p_children: children,
    p_notes: notes,
  });
  if (error) {
    if (error.message.includes('event_full')) {
      const left = Number(error.details);
      fail(left > 0 ? `Sorry, there ${left === 1 ? 'is only 1 place' : `are only ${left} places`} left.` : 'Sorry, this event is now full.');
    }
    if (error.message.includes('rsvp_closed')) fail('Replies for this event have closed');
    if (error.message.includes('event_not_found')) fail('Event not found');
    fail(error.message);
  }

  revalidatePath('/events');
  revalidatePath('/dashboard');
  redirect(`/events?saved=${eventId}#event-${eventId}`);
}
