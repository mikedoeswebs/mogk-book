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

export async function claimGhost(formData: FormData) {
  await requireAdmin();
  const parentId = String(formData.get('parent_id') ?? '');
  const bookingId = String(formData.get('booking_id') ?? '');
  const childId = String(formData.get('child_id') ?? '');

  if (!parentId || !bookingId || !childId) {
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

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, is_ghost')
    .eq('id', bookingId)
    .maybeSingle<{ id: string; is_ghost: boolean }>();
  if (!booking) {
    redirect(`/admin/parents/${parentId}?error=Booking+not+found`);
  }
  if (!booking!.is_ghost) {
    redirect(
      `/admin/parents/${parentId}?error=${encodeURIComponent('Booking is not a ghost')}`,
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
    .eq('id', bookingId);

  if (error) {
    redirect(`/admin/parents/${parentId}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/admin/parents/${parentId}`);
  revalidatePath('/admin/bookings');
  redirect(
    `/admin/parents/${parentId}?success=${encodeURIComponent('Ghost booking claimed')}`,
  );
}
