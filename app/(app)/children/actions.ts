'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireParent } from '@/lib/auth/require-parent';
import type { Child } from '@/lib/db/types';

const CONSENT_REQUIRED =
  'Please tick the consent box so we can hold the medical information you entered.';

function readPlayerForm(formData: FormData) {
  return {
    name: String(formData.get('name') ?? '').trim(),
    dob: String(formData.get('dob') ?? '').trim(),
    notes: String(formData.get('notes') ?? '').trim() || null,
    consent: formData.get('medical_consent') === 'on',
  };
}

function playerFormError(f: ReturnType<typeof readPlayerForm>): string | null {
  if (!f.name) return 'Name required';
  if (!f.dob || !/^\d{4}-\d{2}-\d{2}$/.test(f.dob)) return 'Date of birth required';
  return null;
}

export async function addChild(formData: FormData) {
  const parent = await requireParent();
  const f = readPlayerForm(formData);
  const invalid = playerFormError(f) ?? (f.notes && !f.consent ? CONSENT_REQUIRED : null);
  if (invalid) redirect(`/children?error=${encodeURIComponent(invalid)}`);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('children').insert({
    parent_id: parent.id,
    name: f.name,
    dob: f.dob,
    notes: f.notes,
    medical_consent_at: f.notes ? new Date().toISOString() : null,
  });

  if (error) redirect(`/children?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/children');
  redirect('/children');
}

export async function updateChild(formData: FormData) {
  const parent = await requireParent();
  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/children?error=Missing+id');
  const back = `/children/${id}`;

  const supabase = await createSupabaseServerClient();
  const { data: child } = await supabase
    .from('children')
    .select('notes, medical_consent_at')
    .eq('id', id)
    .eq('parent_id', parent.id)
    .maybeSingle<Pick<Child, 'notes' | 'medical_consent_at'>>();
  if (!child) redirect('/children?error=Player+not+found');

  const f = readPlayerForm(formData);
  // Consent stays valid while the notes it covers are unchanged; new or
  // edited notes need a fresh tick.
  const consentStillValid = !!child.medical_consent_at && child.notes === f.notes;
  const invalid =
    playerFormError(f) ?? (f.notes && !f.consent && !consentStillValid ? CONSENT_REQUIRED : null);
  if (invalid) redirect(`${back}?error=${encodeURIComponent(invalid)}`);

  const medicalConsentAt = !f.notes
    ? null
    : f.consent
    ? new Date().toISOString()
    : child.medical_consent_at;

  const { error } = await supabase
    .from('children')
    .update({ name: f.name, dob: f.dob, notes: f.notes, medical_consent_at: medicalConsentAt })
    .eq('id', id)
    .eq('parent_id', parent.id);

  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/children');
  revalidatePath(back);
  redirect(`${back}?saved=1`);
}

export async function deleteChild(formData: FormData) {
  const parent = await requireParent();
  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/children?error=Missing+id');

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  // Confirm the child belongs to this parent before we touch anything.
  const { data: child } = await supabase
    .from('children')
    .select('id')
    .eq('id', id)
    .eq('parent_id', parent.id)
    .maybeSingle();
  if (!child) redirect('/children?error=Player+not+found');

  // Drop any abandoned (expired Stripe checkout) rows so they don't block the
  // FK delete. They hold no payment, no credit, and no live reservation.
  await admin
    .from('bookings')
    .delete()
    .eq('child_id', id)
    .eq('status', 'abandoned');

  const { error } = await supabase
    .from('children')
    .delete()
    .eq('id', id)
    .eq('parent_id', parent.id);

  if (error) {
    if (error.message.includes('foreign key')) {
      const { count } = await admin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('child_id', id);
      const n = count ?? 0;
      redirect(
        `/children?error=${encodeURIComponent(
          `This player has ${n} booking${n === 1 ? '' : 's'} on record and can't be removed. Contact us if you need this changed.`,
        )}`,
      );
    }
    redirect(`/children?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath('/children');
  redirect('/children');
}
