'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
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
  const { error } = await supabase
    .from('children')
    .delete()
    .eq('id', id)
    .eq('parent_id', parent.id);

  if (error) {
    redirect(
      `/children?error=${encodeURIComponent(
        error.message.includes('foreign key')
          ? 'This player has existing bookings and can\'t be removed.'
          : error.message,
      )}`,
    );
  }
  revalidatePath('/children');
  redirect('/children');
}
