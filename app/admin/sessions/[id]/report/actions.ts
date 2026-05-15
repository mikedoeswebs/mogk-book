'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Booking } from '@/lib/db/types';

export async function saveSessionReport(formData: FormData) {
  await requireAdmin();

  const sessionId = String(formData.get('session_id') ?? '').trim();
  if (!sessionId) redirect('/admin/sessions?error=Missing+session+id');

  const captainId = String(formData.get('captain_booking_id') ?? '').trim() || null;
  const potwId = String(formData.get('player_of_week_booking_id') ?? '').trim() || null;
  const notes = String(formData.get('session_report_notes') ?? '').trim() || null;

  const admin = createSupabaseAdminClient();

  const { data: bookings } = await admin
    .from('bookings')
    .select('id, status')
    .eq('session_id', sessionId)
    .eq('status', 'active')
    .returns<Pick<Booking, 'id' | 'status'>[]>();

  const validIds = new Set((bookings ?? []).map((b) => b.id));

  const attendedIds = new Set<string>();
  const updates: { id: string; attended: boolean | null }[] = [];
  for (const id of validIds) {
    const raw = String(formData.get(`attended_${id}`) ?? 'unset');
    const attended = raw === 'present' ? true : raw === 'missed' ? false : null;
    updates.push({ id, attended });
    if (attended === true) attendedIds.add(id);
  }

  if (captainId && !attendedIds.has(captainId)) {
    redirect(`/admin/sessions/${sessionId}/report?error=${encodeURIComponent('Captain must be marked Present')}`);
  }
  if (potwId && !attendedIds.has(potwId)) {
    redirect(`/admin/sessions/${sessionId}/report?error=${encodeURIComponent('Player of the Week must be marked Present')}`);
  }

  // Persist attendance per-booking (one round trip per row keeps the logic simple; lists are short).
  for (const u of updates) {
    const { error } = await admin
      .from('bookings')
      .update({ attended: u.attended })
      .eq('id', u.id);
    if (error) {
      redirect(`/admin/sessions/${sessionId}/report?error=${encodeURIComponent(error.message)}`);
    }
  }

  const { error: sessionErr } = await admin
    .from('sessions')
    .update({
      captain_booking_id: captainId,
      player_of_week_booking_id: potwId,
      session_report_notes: notes,
    })
    .eq('id', sessionId);

  if (sessionErr) {
    redirect(`/admin/sessions/${sessionId}/report?error=${encodeURIComponent(sessionErr.message)}`);
  }

  revalidatePath(`/admin/sessions/${sessionId}/report`);
  revalidatePath('/admin/sessions');
  redirect(`/admin/sessions/${sessionId}/report?success=Saved`);
}
