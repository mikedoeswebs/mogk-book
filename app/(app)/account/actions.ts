'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireParent } from '@/lib/auth/require-parent';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function saveAccount(formData: FormData) {
  const parent = await requireParent();
  const name = String(formData.get('name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const newEmail = String(formData.get('email') ?? '').trim().toLowerCase();

  if (!name) redirect('/account?error=Please+enter+your+name');
  if (!phone) redirect('/account?error=Please+enter+your+phone+number');
  if (!newEmail) redirect('/account?error=Please+enter+your+email');

  const supabase = await createSupabaseServerClient();

  const { error: updateError } = await supabase
    .from('parents')
    .update({ name, phone })
    .eq('id', parent.id);
  if (updateError) {
    redirect(`/account?error=${encodeURIComponent(updateError.message)}`);
  }

  let emailChangeQueued = false;
  if (newEmail !== parent.email.toLowerCase()) {
    const { error: authError } = await supabase.auth.updateUser({ email: newEmail });
    if (authError) {
      redirect(`/account?error=${encodeURIComponent(authError.message)}`);
    }
    emailChangeQueued = true;
  }

  revalidatePath('/account');
  redirect(
    `/account?success=${encodeURIComponent(
      emailChangeQueued
        ? `Saved. Check ${newEmail} to confirm your new email — until you click the link you'll keep signing in with ${parent.email}.`
        : 'Saved.',
    )}`,
  );
}
