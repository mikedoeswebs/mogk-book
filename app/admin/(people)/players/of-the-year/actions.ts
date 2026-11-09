'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const PATH = '/admin/players/of-the-year';

function readVote(formData: FormData) {
  const year = Number(formData.get('year'));
  const key = String(formData.get('player_key') ?? '').trim();
  const name = String(formData.get('player_name') ?? '').trim();
  if (!Number.isInteger(year) || !key || !name) throw new Error('Invalid vote');
  return { year, key, name };
}

// No redirect: the page re-renders in place so the list keeps its scroll
// position between votes.
export async function castVote(formData: FormData) {
  await requireAdmin();
  const { year, key, name } = readVote(formData);
  const { error } = await createSupabaseAdminClient()
    .from('player_of_year_votes')
    .insert({ year, player_key: key, player_name: name });
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function undoVote(formData: FormData) {
  await requireAdmin();
  const { year, key } = readVote(formData);
  const supabase = createSupabaseAdminClient();
  const { data: last } = await supabase
    .from('player_of_year_votes')
    .select('id')
    .eq('year', year)
    .eq('player_key', key)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last) {
    const { error } = await supabase.from('player_of_year_votes').delete().eq('id', last.id);
    if (error) throw new Error(error.message);
  }
  revalidatePath(PATH);
}
