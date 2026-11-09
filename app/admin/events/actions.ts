'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function readEvent(formData: FormData) {
  const opt = (k: string) => String(formData.get(k) ?? '').trim() || null;
  const event = {
    title: String(formData.get('title') ?? '').trim(),
    date: String(formData.get('date') ?? ''),
    start_time: String(formData.get('start_time') ?? ''),
    end_time: opt('end_time'),
    location: String(formData.get('location') ?? '').trim(),
    description: opt('description'),
    rsvp_by: opt('rsvp_by'),
    capacity: opt('capacity') === null ? null : Number(formData.get('capacity')),
  };
  let error: string | null = null;
  if (!event.title || !DATE.test(event.date) || !event.start_time || !event.location) {
    error = 'Title, date, start time and location are required';
  } else if (event.end_time && event.end_time <= event.start_time) {
    error = 'End time must be after the start time';
  } else if (event.capacity !== null && !(Number.isInteger(event.capacity) && event.capacity > 0)) {
    error = 'Capacity must be a whole number above zero, or empty for no limit';
  } else if (event.rsvp_by && (!DATE.test(event.rsvp_by) || event.rsvp_by > event.date)) {
    error = 'Reply-by date must be on or before the event';
  }
  return { event, error };
}

export async function createEvent(formData: FormData) {
  await requireAdmin();
  const { event, error } = readEvent(formData);
  if (error) redirect(`/admin/events?error=${encodeURIComponent(error)}`);

  const { data, error: dbError } = await createSupabaseAdminClient()
    .from('events')
    .insert(event)
    .select('id')
    .single();
  if (dbError || !data) {
    redirect(`/admin/events?error=${encodeURIComponent(dbError?.message ?? 'Insert failed')}`);
  }
  revalidatePath('/admin/events');
  revalidatePath('/events');
  redirect(`/admin/events/${data.id}`);
}

export async function updateEvent(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  const back = `/admin/events/${id}`;
  const { event, error } = readEvent(formData);
  if (error) redirect(`${back}?error=${encodeURIComponent(error)}`);

  const { error: dbError } = await createSupabaseAdminClient().from('events').update(event).eq('id', id);
  if (dbError) redirect(`${back}?error=${encodeURIComponent(dbError.message)}`);
  revalidatePath('/admin/events');
  revalidatePath(back);
  revalidatePath('/events');
  redirect(`${back}?saved=1`);
}

// RSVPs go with it (on delete cascade).
export async function deleteEvent(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  const { error } = await createSupabaseAdminClient().from('events').delete().eq('id', id);
  if (error) redirect(`/admin/events/${id}?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin/events');
  revalidatePath('/events');
  redirect('/admin/events');
}
