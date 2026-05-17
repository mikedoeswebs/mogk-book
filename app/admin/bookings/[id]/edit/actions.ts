'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const ALLOWED_METHODS = new Set([
  'card',
  'cash',
  'cheque',
  'bank_transfer',
  'free',
  'credit',
  'other',
]);

export async function updateAdminBooking(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get('id') ?? '').trim();
  const amountPounds = Number(formData.get('amount') ?? '0');
  const paymentMethod = String(formData.get('payment_method') ?? '').trim();
  const paymentNote = String(formData.get('payment_note') ?? '').trim() || null;
  const trialistNameRaw = formData.get('trialist_name');
  const trialistName = trialistNameRaw === null ? null : String(trialistNameRaw).trim();

  if (!id) redirect('/admin/bookings?error=Missing+booking+id');
  if (!Number.isFinite(amountPounds) || amountPounds < 0) {
    redirect(`/admin/bookings/${id}/edit?error=${encodeURIComponent('Invalid amount')}`);
  }
  if (!ALLOWED_METHODS.has(paymentMethod)) {
    redirect(`/admin/bookings/${id}/edit?error=${encodeURIComponent('Invalid payment method')}`);
  }

  const admin = createSupabaseAdminClient();

  const { data: existing, error: fetchError } = await admin
    .from('bookings')
    .select('is_ghost')
    .eq('id', id)
    .maybeSingle<{ is_ghost: boolean }>();

  if (fetchError || !existing) {
    redirect(`/admin/bookings/${id}/edit?error=${encodeURIComponent(fetchError?.message ?? 'Booking not found')}`);
  }

  if (existing.is_ghost && !trialistName) {
    redirect(`/admin/bookings/${id}/edit?error=${encodeURIComponent('Player name is required')}`);
  }

  const update: {
    amount_pence: number;
    payment_method: string;
    payment_note: string | null;
    trialist_name?: string;
  } = {
    amount_pence: Math.round(amountPounds * 100),
    payment_method: paymentMethod,
    payment_note: paymentNote,
  };

  if (existing.is_ghost && trialistName) {
    update.trialist_name = trialistName;
  }

  const { error } = await admin
    .from('bookings')
    .update(update)
    .eq('id', id);

  if (error) {
    redirect(`/admin/bookings/${id}/edit?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/admin/bookings');
  redirect('/admin/bookings?success=Booking+updated');
}
