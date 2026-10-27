import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { SubmitButton } from '@/lib/ui/SubmitButton';
import { deletePlayerOfMonth, savePlayerOfMonth } from './actions';

// The award started in January 2026; earlier months never had one.
const FIRST_MONTH = '2026-01';

type Award = { month: string; player_name: string; child_id: string | null; notes: string | null };
type ChildOption = { id: string; name: string; parent: { id: string; name: string } | null };

/** "YYYY-MM" strings from FIRST_MONTH to this month, newest first. */
function monthsSinceStart(): string[] {
  const now = new Date();
  const months: string[] = [];
  let [y, m] = FIRST_MONTH.split('-').map(Number);
  while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth() + 1)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months.reverse();
}

function monthLabel(ym: string): string {
  return new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export default async function PlayerOfMonthPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; error?: string; success?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const supabase = createSupabaseAdminClient();
  const [{ data: awardData }, { data: children }, { data: ghosts }] = await Promise.all([
    supabase.from('player_of_month').select('month, player_name, child_id, notes').returns<Award[]>(),
    supabase.from('children').select('id, name, parent:parents(id, name)').order('name').returns<ChildOption[]>(),
    supabase.from('bookings').select('trialist_name').eq('is_ghost', true),
  ]);

  const awards = new Map((awardData ?? []).map((a) => [a.month.slice(0, 7), a]));
  const childById = new Map((children ?? []).map((c) => [c.id, c]));
  const ghostNames = [...new Set((ghosts ?? []).map((g) => g.trialist_name as string))].sort();

  const months = monthsSinceStart();
  const editing = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : months[0];
  const current = awards.get(editing);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Player of the Month</h1>
        <Link href="/admin/players" className="text-sm">&larr; Players</Link>
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

      <form id="award-form" key={editing} action={savePlayerOfMonth} className="flex flex-wrap items-end gap-3 scroll-mt-4">
        <label className="flex flex-col gap-1 text-sm">
          Month
          <input type="month" name="month" required min={FIRST_MONTH} max={months[0]} defaultValue={editing} />
        </label>
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-48">
          Registered player
          <select name="child_id" defaultValue={current?.child_id ?? ''}>
            <option value="">Not registered</option>
            {(children ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.parent ? ` (${c.parent.name})` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-48">
          Or ghost player name
          <input
            type="text"
            name="player_name"
            list="ghost-names"
            defaultValue={current && !current.child_id ? current.player_name : ''}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-48">
          Notes (optional)
          <input type="text" name="notes" defaultValue={current?.notes ?? ''} />
        </label>
        <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
        <datalist id="ghost-names">
          {ghostNames.map((n) => <option key={n} value={n} />)}
        </datalist>
      </form>
      <p className="text-xs text-fg-muted">
        Pick a registered player where one exists; the name box is only used when none is picked.
        Saving a month that already has a winner replaces it.
      </p>

      <div className="overflow-x-auto"><table className="text-sm">
        <thead>
          <tr>
            <th>Month</th>
            <th>Player</th>
            <th className="hidden sm:table-cell">Notes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {months.map((ym) => {
            const a = awards.get(ym);
            const parent = a?.child_id ? childById.get(a.child_id)?.parent : null;
            return (
              <tr key={ym}>
                <td className="whitespace-nowrap">{monthLabel(ym)}</td>
                <td>
                  {!a ? (
                    <span className="text-fg-muted">Not recorded</span>
                  ) : parent ? (
                    <Link href={`/admin/parents/${parent.id}`}>{a.player_name}</Link>
                  ) : (
                    <>{a.player_name} <span className="text-xs text-fg-muted">(ghost)</span></>
                  )}
                </td>
                <td className="hidden sm:table-cell">{a?.notes ?? ''}</td>
                <td className="text-right whitespace-nowrap">
                  <Link className="text-xs font-normal" href={`/admin/players/of-the-month?month=${ym}#award-form`}>{a ? 'Edit' : 'Set'}</Link>
                  {a && (
                    <>
                      <span className="text-xs text-fg-muted mx-1">{' | '}</span>
                      <form action={deletePlayerOfMonth} className="inline">
                        <input type="hidden" name="month" value={a.month} />
                        <SubmitButton className="bg-transparent border-0 text-fg text-xs hover:text-accent font-normal p-0 no-underline hover:underline">
                          Remove
                        </SubmitButton>
                      </form>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
    </div>
  );
}
