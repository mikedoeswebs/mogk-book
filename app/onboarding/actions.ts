'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/require-user';

export async function saveParentProfile(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const consent = formData.get('consent') === 'on';
  const weeklyEmails = formData.get('weekly_emails') === 'on';

  if (!name) redirect('/onboarding?error=Please+enter+your+name');
  if (!phone) redirect('/onboarding?error=Please+enter+your+phone+number');
  if (!consent) redirect('/onboarding?error=Consent+is+required');

  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from('parents').insert({
    id: user.id,
    email: user.email!,
    name,
    phone,
    weekly_emails: weeklyEmails,
  });

  if (error) {
    redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
  }

  redirect('/children');
}
