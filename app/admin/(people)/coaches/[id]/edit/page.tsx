import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { ArrowLeft } from '@/lib/ui/Icon';
import { SubmitButton } from '@/lib/ui/SubmitButton';
import type { Coach } from '@/lib/db/types';
import { updateCoach } from './actions';

export default async function EditCoachPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;

  const supabase = createSupabaseAdminClient();
  const { data: coach } = await supabase
    .from('coaches')
    .select('*')
    .eq('id', id)
    .maybeSingle<Coach>();
  if (!coach) notFound();

  return (
    <div className="space-y-4">
      <p><Link href="/admin/coaches"><ArrowLeft /> Back to coaches</Link></p>
      <h1 className="text-2xl font-bold">Edit coach</h1>

      {sp.error && (
        <p className="p-3 bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger-fg)] rounded">
          {sp.error}
        </p>
      )}

      <form action={updateCoach} className="space-y-3 max-w-md">
        <input type="hidden" name="id" value={coach.id} />
        <label className="block">
          <span className="block mb-1">Name</span>
          <input type="text" name="name" required defaultValue={coach.name} className="w-full" />
        </label>
        <label className="block">
          <span className="block mb-1">Email</span>
          <input type="email" name="email" defaultValue={coach.email ?? ''} className="w-full" />
        </label>
        <label className="block">
          <span className="block mb-1">Phone</span>
          <input type="tel" name="phone" defaultValue={coach.phone ?? ''} className="w-full" />
        </label>
        <label className="block">
          <span className="block mb-1">Notes</span>
          <textarea name="notes" rows={3} defaultValue={coach.notes ?? ''} className="w-full" />
        </label>
        <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
      </form>
    </div>
  );
}
