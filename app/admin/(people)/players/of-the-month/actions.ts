'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const PATH = '/admin/players/of-the-month';

export async function savePlayerOfMonth(formData: FormData) {
  await requireAdmin();
  const month = String(formData.get('month') ?? '').trim();
  const childId = String(formData.get('child_id') ?? '').trim() || null;
  let playerName = String(formData.get('player_name') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) redirect(`${PATH}?error=Pick+a+month`);

  const supabase = createSupabaseAdminClient();

  // A registered player takes precedence; the typed name is only for ghosts.
  if (childId) {
    const { data: child } = await supabase.from('children').select('name').eq('id', childId).maybeSingle();
    if (!child) redirect(`${PATH}?error=Player+not+found`);
    playerName = child.name;
  }
  if (!playerName) redirect(`${PATH}?error=Pick+a+player+or+enter+a+name`);

  const { error } = await supabase
    .from('player_of_month')
    .upsert({ month: `${month}-01`, player_name: playerName, child_id: childId, notes }, { onConflict: 'month' });
  if (error) redirect(`${PATH}?error=${encodeURIComponent(error.message)}`);

  revalidatePath(PATH);
  redirect(`${PATH}?success=Player+of+the+Month+saved`);
}

export async function deletePlayerOfMonth(formData: FormData) {
  await requireAdmin();
  const month = String(formData.get('month') ?? '').trim();
  if (!/^\d{4}-\d{2}-01$/.test(month)) redirect(`${PATH}?error=Missing+month`);

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('player_of_month').delete().eq('month', month);
  if (error) redirect(`${PATH}?error=${encodeURIComponent(error.message)}`);

  revalidatePath(PATH);
  redirect(`${PATH}?success=Award+removed`);
}
