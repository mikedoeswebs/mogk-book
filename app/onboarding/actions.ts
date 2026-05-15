'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/require-user';
import { sendAdminNewRegistration } from '@/lib/email/send';

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

export async function saveParentProfile(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const consent = formData.get('consent') === 'on';
  const termsAccepted = formData.get('terms_accepted') === 'on';
  const weeklyEmails = formData.get('weekly_emails') === 'on';

  if (!name) redirect('/onboarding?error=Please+enter+your+name');
  if (!phone) redirect('/onboarding?error=Please+enter+your+phone+number');
  if (!consent) redirect('/onboarding?error=Consent+is+required');
  if (!termsAccepted) redirect('/onboarding?error=Please+accept+the+terms+to+continue');

  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from('parents').insert({
    id: user.id,
    email: user.email!,
    name,
    phone,
    weekly_emails: weeklyEmails,
    terms_accepted_at: new Date().toISOString(),
  });

  if (error) {
    redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
  }

  try {
    await sendAdminNewRegistration({
      parent: { name, email: user.email!, phone },
      siteUrl: getSiteUrl(),
    });
  } catch (e) {
    console.error('[onboarding] failed to send admin new-registration notice', e);
  }

  redirect('/children');
}
