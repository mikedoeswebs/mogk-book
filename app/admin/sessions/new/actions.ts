'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { reconcileSessionCoaches } from '@/lib/coaches/sync';

export async function createSession(formData: FormData) {
  await requireAdmin();
  const date = String(formData.get('date') ?? '');
  const start_time = String(formData.get('start_time') ?? '');
  const end_time = String(formData.get('end_time') ?? '');
  const age_group = String(formData.get('age_group') ?? '').trim() || null;
  const capacity = Number(formData.get('capacity'));
  const price = Number(formData.get('price'));
  const notes = String(formData.get('notes') ?? '').trim() || null;
  const coachIds = formData.getAll('coach_ids').map((v) => String(v)).filter(Boolean);

  if (!date || !start_time || !end_time) {
    redirect('/admin/sessions/new?error=Missing+required+fields');
  }
  if (coachIds.length === 0) {
    redirect('/admin/sessions/new?error=Pick+at+least+one+coach');
  }
  if (!Number.isFinite(capacity) || capacity < 1) {
    redirect('/admin/sessions/new?error=Capacity+must+be+a+positive+number');
  }
  if (!Number.isFinite(price) || price < 0) {
    redirect('/admin/sessions/new?error=Price+must+be+zero+or+positive');
  }

  const supabase = createSupabaseAdminClient();

  // coach_name is required on the table; reconcileSessionCoaches will rewrite
  // it to the comma-joined list, but we need a non-null placeholder for the
  // initial insert. Use a temporary single name pulled from the first coach.
  const { data: firstCoach } = await supabase
    .from('coaches')
    .select('name')
    .eq('id', coachIds[0])
    .maybeSingle<{ name: string }>();
  if (!firstCoach) {
    redirect('/admin/sessions/new?error=Selected+coach+not+found');
  }

  const { data: inserted, error } = await supabase
    .from('sessions')
    .insert({
      date,
      start_time,
      end_time,
      coach_name: firstCoach!.name,
      age_group,
      capacity,
      price_pence: Math.round(price * 100),
      notes,
    })
    .select('id')
    .single();

  if (error || !inserted) {
    redirect(`/admin/sessions/new?error=${encodeURIComponent(error?.message ?? 'Insert failed')}`);
  }

  try {
    await reconcileSessionCoaches(supabase, inserted!.id, coachIds);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to link coaches';
    redirect(`/admin/sessions/new?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath('/admin/sessions');
  redirect('/admin/sessions');
}
