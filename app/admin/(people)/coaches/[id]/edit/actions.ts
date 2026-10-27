'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function updateCoach(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim() || null;
  const phone = String(formData.get('phone') ?? '').trim() || null;
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (!id) redirect('/admin/coaches?error=Missing+coach+id');
  if (!name) redirect(`/admin/coaches/${id}/edit?error=Name+required`);

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('coaches')
    .update({ name, email, phone, notes })
    .eq('id', id);
  if (error) {
    const msg = error.message.includes('coaches_name_lower_uniq')
      ? 'A coach with that name already exists.'
      : error.message;
    redirect(`/admin/coaches/${id}/edit?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath('/admin/coaches');
  redirect('/admin/coaches?success=Coach+updated');
}
