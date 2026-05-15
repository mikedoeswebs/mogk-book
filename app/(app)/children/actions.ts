'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireParent } from '@/lib/auth/require-parent';

export async function addChild(formData: FormData) {
  const parent = await requireParent();
  const name = String(formData.get('name') ?? '').trim();
  const dob = String(formData.get('dob') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (!name) redirect('/children?error=Name+required');
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    redirect('/children?error=Date+of+birth+required');
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('children').insert({
    parent_id: parent.id,
    name,
    dob,
    notes,
  });

  if (error) redirect(`/children?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/children');
  redirect('/children');
}

export async function deleteChild(formData: FormData) {
  const parent = await requireParent();
  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/children?error=Missing+id');

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  // Confirm the child belongs to this parent before we touch anything.
  const { data: child } = await supabase
    .from('children')
    .select('id')
    .eq('id', id)
    .eq('parent_id', parent.id)
    .maybeSingle();
  if (!child) redirect('/children?error=Player+not+found');

  // Drop any abandoned (expired Stripe checkout) rows so they don't block the
  // FK delete. They hold no payment, no credit, and no live reservation.
  await admin
    .from('bookings')
    .delete()
    .eq('child_id', id)
    .eq('status', 'abandoned');

  const { error } = await supabase
    .from('children')
    .delete()
    .eq('id', id)
    .eq('parent_id', parent.id);

  if (error) {
    if (error.message.includes('foreign key')) {
      const { count } = await admin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('child_id', id);
      const n = count ?? 0;
      redirect(
        `/children?error=${encodeURIComponent(
          `This player has ${n} booking${n === 1 ? '' : 's'} on record and can't be removed. Contact us if you need this changed.`,
        )}`,
      );
    }
    redirect(`/children?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath('/children');
  redirect('/children');
}
