import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatPence } from '@/lib/format';
import { SubmitButton } from '@/lib/ui/SubmitButton';
import type { Parent } from '@/lib/db/types';

type Row = Parent & {
  children: { id: string }[];
  bookings: { id: string }[];
  balance: number;
};

export default async function AdminParentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();

  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from('parents')
    .select('*, children:children(id), bookings:bookings(id)')
    .order('name', { ascending: true })
    .limit(500);

  if (q) {
    query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data } = await query;
  const parents = (data ?? []) as (Parent & {
    children: { id: string }[];
    bookings: { id: string }[];
  })[];

  const balances = await Promise.all(
    parents.map((p) =>
      supabase.rpc('parent_credit_balance', { p_parent_id: p.id }),
    ),
  );
  const rows: Row[] = parents.map((p, i) => ({
    ...p,
    balance: (balances[i].data as number) ?? 0,
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Parents</h1>

      <form className="flex gap-2 max-w-md">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by name or email"
          className="flex-1"
        />
        <SubmitButton pendingLabel="Searching…">Search</SubmitButton>
        {q && (
          <Link href="/admin/parents" className="text-sm self-center">Clear</Link>
        )}
      </form>

      {rows.length === 0 ? (
        <p className="text-fg-muted">No parents match.</p>
      ) : (
        <div className="overflow-x-auto"><table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Players</th>
              <th>Bookings</th>
              <th>Credit</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.email}</td>
                <td>{p.children.length}</td>
                <td>{p.bookings.length}</td>
                <td className={p.balance < 0 ? 'text-[var(--danger-fg)]' : ''}>
                  {formatPence(p.balance)}
                </td>
                <td className="text-right">
                  <Link className="text-sm" href={`/admin/parents/${p.id}`}>View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}
