import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { SubmitButton } from '@/lib/ui/SubmitButton';
import { formatDate } from '@/lib/format';
import { getLapsedPlayers } from '@/lib/admin/lapsed';

const MONTH_OPTIONS = [3, 6, 12];
const MAX_SESSION_OPTIONS = [1, 2, 3];
const WEEK_OPTIONS = [2, 3, 4, 8];

function pick(raw: string | undefined, allowed: number[], fallback: number): number {
  const n = Number(raw);
  return allowed.includes(n) ? n : fallback;
}

export default async function LapsedPlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ months?: string; max?: string; weeks?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const months = pick(sp.months, MONTH_OPTIONS, 6);
  const maxSessions = pick(sp.max, MAX_SESSION_OPTIONS, 2);
  const minWeeksSince = pick(sp.weeks, WEEK_OPTIONS, 3);

  const supabase = createSupabaseAdminClient();
  const rows = await getLapsedPlayers(supabase, { months, maxSessions, minWeeksSince });

  const emails = [...new Set(rows.map((r) => r.parent_email))];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Lapsed players</h1>
        <Link href="/admin/players" className="text-sm">&larr; All players</Link>
      </div>

      <p className="text-fg-muted max-w-2xl">
        Players who came to {maxSessions === 1 ? '1 session' : `${maxSessions} or fewer sessions`}, starting
        within the last {months} months, and haven&apos;t been back or booked again in at
        least {minWeeksSince} weeks. Sessions marked as missed on the register aren&apos;t counted.
        Ghost bookings are left out, as there&apos;s no parent to contact.
      </p>

      <form className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          First session within
          <select name="months" defaultValue={months} className="block">
            {MONTH_OPTIONS.map((m) => <option key={m} value={m}>{m} months</option>)}
          </select>
        </label>
        <label className="text-sm">
          Sessions attended
          <select name="max" defaultValue={maxSessions} className="block">
            {MAX_SESSION_OPTIONS.map((m) => <option key={m} value={m}>{m === 1 ? 'Just 1' : `Up to ${m}`}</option>)}
          </select>
        </label>
        <label className="text-sm">
          Not seen for at least
          <select name="weeks" defaultValue={minWeeksSince} className="block">
            {WEEK_OPTIONS.map((w) => <option key={w} value={w}>{w} weeks</option>)}
          </select>
        </label>
        <SubmitButton pendingLabel="Filtering…">Filter</SubmitButton>
      </form>

      {rows.length === 0 ? (
        <p className="p-3 bg-surface border border-line rounded text-fg-muted">
          No lapsed players match these filters.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-fg-muted">
              {rows.length} {rows.length === 1 ? 'player' : 'players'}
            </span>
            <a href={`mailto:?bcc=${emails.map(encodeURIComponent).join(',')}`}>
              Email all parents (BCC)
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="text-sm md:text-base min-w-[40rem]">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Parent</th>
                  <th>Sessions</th>
                  <th>Last seen</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.child_id}>
                    <td>{r.child_name}</td>
                    <td>
                      {r.parent_name}<br />
                      <a href={`mailto:${r.parent_email}`} className="text-sm">{r.parent_email}</a>
                      {r.parent_phone && (
                        <>
                          <br />
                          <a href={`tel:${r.parent_phone}`} className="text-sm">{r.parent_phone}</a>
                        </>
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      {r.session_dates.map((d) => <div key={d}>{formatDate(d)}</div>)}
                    </td>
                    <td className="whitespace-nowrap">
                      {r.days_since} days ago
                    </td>
                    <td className="text-right">
                      <Link className="text-sm" href={`/admin/parents/${r.parent_id}`}>View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
