import { requireParent } from '@/lib/auth/require-parent';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatDob } from '@/lib/format';
import { SubmitButton } from '@/lib/ui/SubmitButton';
import type { Child } from '@/lib/db/types';
import Link from 'next/link';
import { addChild, deleteChild } from './actions';
import { MedicalFields } from './MedicalFields';

export default async function ChildrenPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const parent = await requireParent();
  const supabase = await createSupabaseServerClient();
  const { data: children } = await supabase
    .from('children')
    .select('*')
    .eq('parent_id', parent.id)
    .order('created_at', { ascending: true })
    .returns<Child[]>();

  const params = await searchParams;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My players</h1>
      {params.error && (
        <p className="p-3 bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger-fg)] rounded">{params.error}</p>
      )}

      {children && children.length > 0 ? (
        <div className="overflow-x-auto"><table>
          <thead>
            <tr>
              <th>Name</th>
              <th>DOB</th>
              <th>Medical / other info</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {children.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/children/${c.id}`}>{c.name}</Link></td>
                <td>{c.dob ? formatDob(c.dob) : '-'}</td>
                <td>{c.notes ?? '-'}</td>
                <td className="text-right">
                  <form action={deleteChild}>
                    <input type="hidden" name="id" value={c.id} />
                    <SubmitButton pendingLabel="Removing…">Remove</SubmitButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      ) : (
        <p>No players added yet. Add one below to start booking sessions.</p>
      )}

      <section className="space-y-2">
        <h2 className="text-xl font-bold">Add a player</h2>
        <form action={addChild} className="space-y-3 max-w-md">
          <label className="block">
            <span className="block mb-1">Name</span>
            <input type="text" name="name" required className="w-full" />
          </label>
          <label className="block">
            <span className="block mb-1">Date of birth</span>
            <input type="date" name="dob" required className="w-full" />
          </label>
          <MedicalFields />
          <SubmitButton pendingLabel="Adding…">Add player</SubmitButton>
        </form>
      </section>
    </div>
  );
}
