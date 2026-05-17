import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { ArrowLeft } from '@/lib/ui/Icon';
import { SubmitButton } from '@/lib/ui/SubmitButton';
import type { Coach } from '@/lib/db/types';
import { createSession } from './actions';

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const supabase = createSupabaseAdminClient();
  const { data: coaches } = await supabase
    .from('coaches')
    .select('*')
    .eq('active', true)
    .order('name', { ascending: true })
    .returns<Coach[]>();

  return (
    <div className="space-y-4">
      <p><Link href="/admin/sessions"><ArrowLeft /> Back to sessions</Link></p>
      <h1 className="text-2xl font-bold">New session</h1>
      {sp.error && (
        <p className="p-3 bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger-fg)] rounded">{sp.error}</p>
      )}
      <form action={createSession} className="space-y-3 max-w-md">
        <label className="block">
          <span className="block mb-1">Date</span>
          <input type="date" name="date" required className="w-full" />
        </label>
        <div className="flex gap-3">
          <label className="block flex-1">
            <span className="block mb-1">Start</span>
            <input type="time" name="start_time" required className="w-full" defaultValue="19:00" />
          </label>
          <label className="block flex-1">
            <span className="block mb-1">End</span>
            <input type="time" name="end_time" required className="w-full" defaultValue="20:00" />
          </label>
        </div>
        <fieldset className="border border-line rounded p-3">
          <legend className="px-1 text-sm text-fg-muted">Coaches</legend>
          {(coaches ?? []).length === 0 ? (
            <p className="text-sm text-fg-muted">
              No active coaches yet. <Link href="/admin/coaches/new">Add one</Link> first.
            </p>
          ) : (
            <ul className="space-y-1">
              {(coaches ?? []).map((c) => (
                <li key={c.id}>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="coach_ids" value={c.id} />
                    <span>{c.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
        <label className="block">
          <span className="block mb-1">Group</span>
          <input type="text" name="age_group" placeholder="e.g. Main, Academy" required className="w-full" />
        </label>
        <div className="flex gap-3">
          <label className="block flex-1">
            <span className="block mb-1">Capacity</span>
            <input type="number" name="capacity" min={1} required className="w-full" />
          </label>
          <label className="block flex-1">
            <span className="block mb-1">Price (£)</span>
            <input type="number" name="price" min={0} step="0.01" required className="w-full" />
          </label>
        </div>
        <label className="block">
          <span className="block mb-1">Notes (shown to parents)</span>
          <textarea name="notes" rows={3} className="w-full" />
        </label>
        <SubmitButton pendingLabel="Creating…">Create session</SubmitButton>
      </form>
    </div>
  );
}
