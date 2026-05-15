'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { reconcileSessionCoaches } from '@/lib/coaches/sync';

export async function updateSession(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/admin/sessions');

  const date = String(formData.get('date') ?? '');
  const start_time = String(formData.get('start_time') ?? '');
  const end_time = String(formData.get('end_time') ?? '');
  const age_group = String(formData.get('age_group') ?? '').trim() || null;
  const capacity = Number(formData.get('capacity'));
  const price = Number(formData.get('price'));
  const notes = String(formData.get('notes') ?? '').trim() || null;
  const coachIds = formData.getAll('coach_ids').map((v) => String(v)).filter(Boolean);

  if (coachIds.length === 0) {
    redirect(`/admin/sessions/${id}/edit?error=Pick+at+least+one+coach`);
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('sessions')
    .update({
      date,
      start_time,
      end_time,
      age_group,
      capacity,
      price_pence: Math.round(price * 100),
      notes,
    })
    .eq('id', id);

  if (error) redirect(`/admin/sessions/${id}/edit?error=${encodeURIComponent(error.message)}`);

  try {
    await reconcileSessionCoaches(supabase, id, coachIds);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to update coaches';
    redirect(`/admin/sessions/${id}/edit?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath('/admin/sessions');
  redirect('/admin/sessions');
}

export async function cancelSession(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/admin/sessions');

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('sessions')
    .update({ status: 'cancelled' })
    .eq('id', id);

  if (error) redirect(`/admin/sessions/${id}/edit?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin/sessions');
  redirect('/admin/sessions');
}

export async function reopenSession(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/admin/sessions');

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('sessions')
    .update({ status: 'open' })
    .eq('id', id);

  if (error) redirect(`/admin/sessions/${id}/edit?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin/sessions');
  redirect(`/admin/sessions/${id}/edit`);
}

/**
 * Hard-delete a session and every booking attached to it.
 *
 * `bookings → sessions` is ON DELETE RESTRICT, so we delete the dependent
 * bookings first. `session_coaches → sessions` cascades automatically.
 * Credits that referenced these bookings have ON DELETE SET NULL, so the
 * credit-ledger entries themselves stay (we don't want to silently rewrite
 * a parent's historical credit balance).
 */
export async function deleteSession(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  const confirm = String(formData.get('confirm') ?? '').trim();

  if (!id) redirect('/admin/sessions');
  if (confirm !== 'DELETE') {
    redirect(`/admin/sessions/${id}/edit?error=${encodeURIComponent('Type DELETE to confirm.')}`);
  }

  const supabase = createSupabaseAdminClient();

  // Delete bookings for this session first (FK is ON DELETE RESTRICT).
  const { error: bookingsErr } = await supabase
    .from('bookings')
    .delete()
    .eq('session_id', id);
  if (bookingsErr) {
    redirect(`/admin/sessions/${id}/edit?error=${encodeURIComponent(bookingsErr.message)}`);
  }

  const { error: sessionErr } = await supabase.from('sessions').delete().eq('id', id);
  if (sessionErr) {
    redirect(`/admin/sessions/${id}/edit?error=${encodeURIComponent(sessionErr.message)}`);
  }

  revalidatePath('/admin/sessions');
  redirect('/admin/sessions?deleted=1');
}
