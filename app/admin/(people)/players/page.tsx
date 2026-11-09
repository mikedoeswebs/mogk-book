import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { SubmitButton } from '@/lib/ui/SubmitButton';
import { SortHeader, parseSort } from '@/lib/ui/SortHeader';
import type { Child, Parent } from '@/lib/db/types';

type Row = Child & {
  parent: Pick<Parent, 'id' | 'name' | 'email'> | null;
  bookings: { id: string }[];
};

function calcAge(dob: string): number {
  const d = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

export default async function AdminPlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; dir?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const sort = parseSort(sp);

  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from('children')
    .select('*, parent:parents(id, name, email), bookings:bookings(id)')
    // A later DOB is a younger player, so age order is the reverse of DOB order.
    .order(sort.key === 'age' ? 'dob' : 'name', {
      ascending: sort.key === 'age' ? !sort.asc : sort.asc,
      nullsFirst: false,
    })
    .limit(500);

  if (q) {
    query = query.ilike('name', `%${q}%`);
  }

  const { data } = await query;
  const rows = (data ?? []) as Row[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Players</h1>
        <div className="flex gap-4">
          <Link href="/admin/players/of-the-month" className="text-sm">Player of the Month &rarr;</Link>
          <Link href="/admin/players/of-the-year" className="text-sm">Player of the Year votes &rarr;</Link>
          <Link href="/admin/players/lapsed" className="text-sm">Lapsed players &rarr;</Link>
        </div>
      </div>

      <form className="flex gap-2 max-w-md">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by name"
          className="flex-1"
        />
        <SubmitButton pendingLabel="Searching…">Search</SubmitButton>
        {q && (
          <Link href="/admin/players" className="text-sm self-center">Clear</Link>
        )}
      </form>

      {rows.length === 0 ? (
        <p className="text-fg-muted">No players match.</p>
      ) : (
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <SortHeader label="Name" col="name" sort={sort} path="/admin/players" params={{ q }} />
                <SortHeader
                  label="Age"
                  col="age"
                  sort={sort}
                  path="/admin/players"
                  params={{ q }}
                  className="hidden sm:table-cell"
                />
                <th>Parent</th>
                <th>Bookings</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td className="hidden sm:table-cell whitespace-nowrap">
                    {r.dob ? `${calcAge(r.dob)} yrs` : '—'}
                  </td>
                  <td>
                    {r.parent ? (
                      <Link href={`/admin/parents/${r.parent.id}`} className="text-sm">
                        {r.parent.name}
                      </Link>
                    ) : (
                      <span className="text-fg-muted">—</span>
                    )}
                  </td>
                  <td>{r.bookings.length}</td>
                  <td className="text-right">
                    {r.parent && (
                      <Link className="text-sm" href={`/admin/parents/${r.parent.id}`}>
                        View
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
