'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function createCoach(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim() || null;
  const phone = String(formData.get('phone') ?? '').trim() || null;
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (!name) redirect('/admin/coaches/new?error=Name+required');

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('coaches').insert({ name, email, phone, notes });
  if (error) {
    const msg = error.message.includes('coaches_name_lower_uniq')
      ? 'A coach with that name already exists.'
      : error.message;
    redirect(`/admin/coaches/new?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath('/admin/coaches');
  redirect('/admin/coaches?success=Coach+added');
}
