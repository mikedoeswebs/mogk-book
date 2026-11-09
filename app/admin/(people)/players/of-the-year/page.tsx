import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { SubmitButton } from '@/lib/ui/SubmitButton';
import { castVote, undoVote } from './actions';

type Player = { player_key: string; player_name: string; is_ghost: boolean };

export default async function PlayerOfYearPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const q = ((await searchParams).q ?? '').trim();

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
  const year = Number(today.slice(0, 4));

  const supabase = createSupabaseAdminClient();
  const [{ data: attended, error }, { data: votes }] = await Promise.all([
    supabase.rpc('analytics_player_attendance', { p_start: `${year}-01-01`, p_end: today, p_limit: null }),
    supabase.from('player_of_year_votes').select('player_key').eq('year', year),
  ]);
  if (error) throw new Error(error.message);

  const tally = new Map<string, number>();
  for (const v of votes ?? []) tally.set(v.player_key, (tally.get(v.player_key) ?? 0) + 1);

  const players = ((attended ?? []) as Player[]).sort((a, b) => a.player_name.localeCompare(b.player_name));
  const leaders = players
    .filter((p) => tally.has(p.player_key))
    .sort((a, b) => tally.get(b.player_key)! - tally.get(a.player_key)!);
  const shown = q ? players.filter((p) => p.player_name.toLowerCase().includes(q.toLowerCase())) : players;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Player of the Year {year}</h1>
        <Link href="/admin/players" className="text-sm">&larr; Players</Link>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Standings ({votes?.length ?? 0} votes)</h2>
        {leaders.length === 0 ? (
          <p className="text-fg-muted">No votes yet.</p>
        ) : (
          <ol className="list-decimal pl-6">
            {leaders.map((p) => (
              <li key={p.player_key}>
                {p.player_name} <strong>{tally.get(p.player_key)}</strong>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Players attended in {year} ({players.length})</h2>
        <form className="flex gap-2 max-w-md">
          <input type="search" name="q" defaultValue={q} placeholder="Search by name" className="flex-1" />
          <SubmitButton pendingLabel="Searching…">Search</SubmitButton>
          {q && <Link href="/admin/players/of-the-year" className="text-sm self-center">Clear</Link>}
        </form>

        <div className="overflow-x-auto"><table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Votes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => {
              const hidden = (
                <>
                  <input type="hidden" name="year" value={year} />
                  <input type="hidden" name="player_key" value={p.player_key} />
                  <input type="hidden" name="player_name" value={p.player_name} />
                </>
              );
              return (
                <tr key={p.player_key}>
                  <td>
                    {p.player_name}
                    {p.is_ghost && <span className="text-xs text-fg-muted"> (ghost)</span>}
                  </td>
                  <td>{tally.get(p.player_key) ?? 0}</td>
                  <td className="text-right whitespace-nowrap">
                    {tally.has(p.player_key) && (
                      <form action={undoVote} className="inline mr-3">
                        {hidden}
                        <SubmitButton
                          aria-label={`Remove a vote for ${p.player_name}`}
                          className="bg-transparent border-0 text-fg text-xs hover:text-accent font-normal p-0 hover:underline"
                        >
                          Undo
                        </SubmitButton>
                      </form>
                    )}
                    <form action={castVote} className="inline">
                      {hidden}
                      <SubmitButton aria-label={`Add a vote for ${p.player_name}`}>+1</SubmitButton>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </section>
    </div>
  );
}
