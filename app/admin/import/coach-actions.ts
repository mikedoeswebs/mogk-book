'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { CoachAssignmentRow } from '@/lib/import/coachAssignments';

export async function runCoachAssignmentsImport(formData: FormData) {
  await requireAdmin();

  const rowsJson = String(formData.get('rows_json') ?? '');
  let rows: CoachAssignmentRow[];
  try {
    rows = JSON.parse(rowsJson) as CoachAssignmentRow[];
  } catch {
    redirect('/admin/import?error=Invalid+coach+assignments+data');
  }

  if (!Array.isArray(rows!) || rows!.length === 0) {
    redirect('/admin/import?error=No+coach+assignment+rows+to+import');
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc('import_coach_assignments_batch', {
    p_rows: rows!,
  });

  if (error) {
    redirect(`/admin/import?error=${encodeURIComponent(error.message)}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  const params = new URLSearchParams({
    coach_success: '1',
    coach_rows: String(row?.rows_processed ?? 0),
    coach_created: String(row?.coaches_created ?? 0),
    coach_dates: String(row?.dates_affected ?? 0),
    coach_links: String(row?.links_set ?? 0),
    coach_skipped: String(row?.rows_skipped ?? 0),
  });

  revalidatePath('/admin/sessions');
  revalidatePath('/admin/coaches');
  redirect(`/admin/import?${params.toString()}`);
}
