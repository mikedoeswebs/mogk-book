'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function adjustCredit(formData: FormData) {
  await requireAdmin();
  const parentId = String(formData.get('parent_id') ?? '');
  const amount = Number(formData.get('amount'));
  const note = String(formData.get('note') ?? '').trim() || null;

  if (!parentId) redirect('/admin/parents?error=Missing+parent');
  if (!Number.isFinite(amount) || amount === 0) {
    redirect(
      `/admin/parents/${parentId}?error=${encodeURIComponent('Amount must be non-zero')}`,
    );
  }

  const amountPence = Math.round(amount * 100);
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase.from('credits').insert({
    parent_id: parentId,
    amount_pence: amountPence,
    reason: 'admin_adjustment',
    note,
  });

  if (error) {
    redirect(`/admin/parents/${parentId}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/admin/parents/${parentId}`);
  redirect(
    `/admin/parents/${parentId}?success=${encodeURIComponent(
      amountPence > 0 ? 'Credit added' : 'Credit deducted',
    )}`,
  );
}

export async function adminDeleteChild(formData: FormData) {
  await requireAdmin();
  const parentId = String(formData.get('parent_id') ?? '');
  const childId = String(formData.get('child_id') ?? '');
  if (!parentId || !childId) {
    redirect(`/admin/parents/${parentId}?error=Missing+fields`);
  }

  const supabase = createSupabaseAdminClient();

  const { data: child } = await supabase
    .from('children')
    .select('id')
    .eq('id', childId)
    .eq('parent_id', parentId)
    .maybeSingle();
  if (!child) {
    redirect(
      `/admin/parents/${parentId}?error=${encodeURIComponent(
        'Player does not belong to this parent',
      )}`,
    );
  }

  // Cascade through bookings first (FK is on delete restrict). Credits and
  // session captain/POW pointers fall back to on delete set null, so history
  // stays intact even after the booking row goes.
  const { error: bookingError } = await supabase
    .from('bookings')
    .delete()
    .eq('child_id', childId);
  if (bookingError) {
    redirect(
      `/admin/parents/${parentId}?error=${encodeURIComponent(bookingError.message)}`,
    );
  }

  const { error } = await supabase
    .from('children')
    .delete()
    .eq('id', childId)
    .eq('parent_id', parentId);
  if (error) {
    redirect(`/admin/parents/${parentId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/admin/parents/${parentId}`);
  revalidatePath('/admin/parents');
  redirect(
    `/admin/parents/${parentId}?success=${encodeURIComponent('Player removed')}`,
  );
}

export async function claimGhost(formData: FormData) {
  await requireAdmin();
  const parentId = String(formData.get('parent_id') ?? '');
  const childId = String(formData.get('child_id') ?? '');
  const bookingIds = String(formData.get('booking_ids') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!parentId || !childId || bookingIds.length === 0) {
    redirect(`/admin/parents/${parentId}?error=Missing+fields`);
  }

  const supabase = createSupabaseAdminClient();

  const { data: child } = await supabase
    .from('children')
    .select('id')
    .eq('id', childId)
    .eq('parent_id', parentId)
    .maybeSingle();
  if (!child) {
    redirect(
      `/admin/parents/${parentId}?error=${encodeURIComponent(
        'Player does not belong to this parent',
      )}`,
    );
  }

  const { data: matching, error: checkError } = await supabase
    .from('bookings')
    .select('id')
    .in('id', bookingIds)
    .eq('is_ghost', true);
  if (checkError) {
    redirect(`/admin/parents/${parentId}?error=${encodeURIComponent(checkError.message)}`);
  }
  const validIds = (matching ?? []).map((r) => r.id);
  if (validIds.length === 0) {
    redirect(
      `/admin/parents/${parentId}?error=${encodeURIComponent(
        'No matching ghost bookings to claim',
      )}`,
    );
  }

  const { error } = await supabase
    .from('bookings')
    .update({
      parent_id: parentId,
      child_id: childId,
      is_ghost: false,
      trialist_name: null,
    })
    .in('id', validIds);

  if (error) {
    redirect(`/admin/parents/${parentId}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/admin/parents/${parentId}`);
  revalidatePath('/admin/bookings');
  redirect(
    `/admin/parents/${parentId}?success=${encodeURIComponent(
      `${validIds.length} booking${validIds.length === 1 ? '' : 's'} claimed`,
    )}`,
  );
}
