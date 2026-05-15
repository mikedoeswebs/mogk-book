import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/require-user';
import { Logo } from '@/lib/ui/Logo';
import { saveParentProfile } from './actions';

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data: parent } = await supabase
    .from('parents')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  if (parent) redirect('/sessions');

  const params = await searchParams;

  return (
    <main className="max-w-md mx-auto p-6 py-12 space-y-4">
      <Logo size="text-sm" />
      <h1 className="text-3xl font-bold">Finish setting up</h1>
      <p className="text-fg-muted">We need a couple of details so coaches can contact you if needed.</p>
      {params.error && (
        <p className="p-3 bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger-fg)] rounded">{params.error}</p>
      )}
      <form action={saveParentProfile} className="space-y-3">
        <label className="block">
          <span className="block mb-1">Your name</span>
          <input type="text" name="name" required className="w-full" />
        </label>
        <label className="block">
          <span className="block mb-1">Phone number</span>
          <input type="tel" name="phone" required className="w-full" />
        </label>
        <label className="block">
          <input type="checkbox" name="weekly_emails" /> Email me a weekly summary of
          upcoming sessions on Friday mornings. You can change this any time from
          &quot;My account&quot;.
        </label>
        <label className="block">
          <input type="checkbox" name="consent" required /> I consent to my player&apos;s
          information being stored for the purposes of running these coaching sessions.
        </label>
        <button type="submit">Save and continue</button>
      </form>
    </main>
  );
}
