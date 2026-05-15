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

  if (!id) redirect('/admin/bookings?error=Missing+booking+id');
  if (!Number.isFinite(amountPounds) || amountPounds < 0) {
    redirect(`/admin/bookings/${id}/edit?error=${encodeURIComponent('Invalid amount')}`);
  }
  if (!ALLOWED_METHODS.has(paymentMethod)) {
    redirect(`/admin/bookings/${id}/edit?error=${encodeURIComponent('Invalid payment method')}`);
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('bookings')
    .update({
      amount_pence: Math.round(amountPounds * 100),
      payment_method: paymentMethod,
      payment_note: paymentNote,
    })
    .eq('id', id);

  if (error) {
    redirect(`/admin/bookings/${id}/edit?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/admin/bookings');
  redirect('/admin/bookings?success=Booking+updated');
}
