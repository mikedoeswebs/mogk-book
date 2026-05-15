import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Coach } from '@/lib/db/types';
import { toggleCoachActive } from './actions';

export default async function CoachesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const supabase = createSupabaseAdminClient();
  const { data: coaches } = await supabase
    .from('coaches')
    .select('*')
    .order('active', { ascending: false })
    .order('name', { ascending: true })
    .returns<Coach[]>();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Coaches</h1>
        <Link href="/admin/coaches/new">+ New coach</Link>
      </div>

      {sp.success && (
        <p className="p-3 bg-[var(--ok-bg)] border border-[var(--ok-line)] text-[var(--ok-fg)] rounded">
          {sp.success}
        </p>
      )}
      {sp.error && (
        <p className="p-3 bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger-fg)] rounded">
          {sp.error}
        </p>
      )}

      {!coaches || coaches.length === 0 ? (
        <p className="text-fg-muted">No coaches yet. Add one to get started.</p>
      ) : (
        <div className="overflow-x-auto"><table className="text-sm">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {coaches.map((c) => (
              <tr key={c.id} className={c.active ? '' : 'opacity-50'}>
                <td>{c.name}</td>
                <td>{c.email ?? '-'}</td>
                <td>{c.phone ?? '-'}</td>
                <td>{c.active ? 'Active' : 'Archived'}</td>
                <td className="text-right whitespace-nowrap">
                  <Link className="text-xs font-normal" href={`/admin/coaches/${c.id}/edit`}>Edit</Link>
                  <span className="text-xs text-fg-muted mx-1">{' | '}</span>
                  <form action={toggleCoachActive} className="inline">
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="active" value={c.active ? '0' : '1'} />
                    <button
                      type="submit"
                      className="bg-transparent border-0 text-fg text-xs hover:text-accent font-normal p-0 no-underline hover:underline capitalize"
                    >
                      {c.active ? 'Archive' : 'Restore'}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}
