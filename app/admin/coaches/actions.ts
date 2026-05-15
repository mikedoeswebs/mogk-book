'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function toggleCoachActive(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  const active = String(formData.get('active') ?? '0') === '1';
  if (!id) redirect('/admin/coaches?error=Missing+coach+id');

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('coaches').update({ active }).eq('id', id);
  if (error) redirect(`/admin/coaches?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/admin/coaches');
  redirect(`/admin/coaches?success=Coach+${active ? 'restored' : 'archived'}`);
}
