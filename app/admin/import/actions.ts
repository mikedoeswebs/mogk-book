'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { HistoricRow } from '@/lib/import/historic';

const ALLOWED_PAYMENT_METHODS = new Set([
  'card', 'cash', 'cheque', 'bank_transfer', 'free', 'credit', 'other',
]);

export async function runImport(formData: FormData) {
  await requireAdmin();

  const rowsJson = String(formData.get('rows_json') ?? '');
  let rows: HistoricRow[];
  try {
    rows = JSON.parse(rowsJson) as HistoricRow[];
  } catch {
    redirect('/admin/import?error=Invalid+row+data');
  }

  if (!Array.isArray(rows!) || rows!.length === 0) {
    redirect('/admin/import?error=No+rows+to+import');
  }

  const mainCoachIds = formData.getAll('main_coach_ids').map((v) => String(v)).filter(Boolean);
  const academyCoachIds = formData.getAll('academy_coach_ids').map((v) => String(v)).filter(Boolean);
  const mainStart = String(formData.get('main_start') ?? '').trim();
  const mainEnd = String(formData.get('main_end') ?? '').trim();
  const academyStart = String(formData.get('academy_start') ?? '').trim();
  const academyEnd = String(formData.get('academy_end') ?? '').trim();
  const mainPriceStr = String(formData.get('main_price') ?? '0').trim();
  const academyPriceStr = String(formData.get('academy_price') ?? '0').trim();
  const mainCapacityStr = String(formData.get('main_capacity') ?? '0').trim();
  const academyCapacityStr = String(formData.get('academy_capacity') ?? '0').trim();
  const paymentMethod = String(formData.get('payment_method') ?? 'cash').trim();

  if (mainCoachIds.length === 0 || academyCoachIds.length === 0) {
    redirect('/admin/import?error=Pick+at+least+one+coach+for+each+group');
  }
  if (!mainStart || !mainEnd || !academyStart || !academyEnd) {
    redirect('/admin/import?error=All+four+time+fields+are+required');
  }
  const mainPriceNum = Number(mainPriceStr);
  const academyPriceNum = Number(academyPriceStr);
  const mainCapacityNum = Number(mainCapacityStr);
  const academyCapacityNum = Number(academyCapacityStr);
  if (!Number.isFinite(mainPriceNum) || mainPriceNum < 0) {
    redirect('/admin/import?error=Invalid+Main+price');
  }
  if (!Number.isFinite(academyPriceNum) || academyPriceNum < 0) {
    redirect('/admin/import?error=Invalid+Academy+price');
  }
  if (!Number.isFinite(mainCapacityNum) || mainCapacityNum <= 0) {
    redirect('/admin/import?error=Invalid+Main+capacity');
  }
  if (!Number.isFinite(academyCapacityNum) || academyCapacityNum <= 0) {
    redirect('/admin/import?error=Invalid+Academy+capacity');
  }
  if (!ALLOWED_PAYMENT_METHODS.has(paymentMethod)) {
    redirect('/admin/import?error=Invalid+payment+method');
  }

  const mainPricePence = Math.round(mainPriceNum * 100);
  const academyPricePence = Math.round(academyPriceNum * 100);

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc('import_historic_batch', {
    p_rows: rows!,
    p_main_coach_ids: mainCoachIds,
    p_academy_coach_ids: academyCoachIds,
    p_main_start: mainStart,
    p_main_end: mainEnd,
    p_academy_start: academyStart,
    p_academy_end: academyEnd,
    p_main_price_pence: mainPricePence,
    p_academy_price_pence: academyPricePence,
    p_main_capacity: mainCapacityNum,
    p_academy_capacity: academyCapacityNum,
    p_payment_method: paymentMethod,
  });

  if (error) {
    redirect(`/admin/import?error=${encodeURIComponent(error.message)}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  const params = new URLSearchParams({
    success: '1',
    sessions: String(row?.sessions_created ?? 0),
    bookings: String(row?.bookings_created ?? 0),
    awards: String(row?.awards_set ?? 0),
    skipped: String(row?.rows_skipped ?? 0),
  });

  revalidatePath('/admin/sessions');
  revalidatePath('/admin/analytics');
  redirect(`/admin/import?${params.toString()}`);
}
