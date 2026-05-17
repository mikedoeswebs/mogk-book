import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { ArrowLeft, ArrowRight } from '@/lib/ui/Icon';
import {
  getRangeSummary,
  getMonthlyTrend,
  getCoachAttendance,
  getCaptainLeaderboard,
  getPotwLeaderboard,
  getPlayerAttendance,
  type RangeSummary,
  type CoachAttendanceRow,
  type AwardLeaderboardRow,
  type PlayerAttendanceRow,
} from '@/lib/admin/analytics';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// The club started in 2023 - no point letting admins navigate further back.
const MIN_YEAR = 2023;

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const currentYear = new Date().getUTCFullYear();
  const maxYear = currentYear + 1;
  const year = parseYear(sp.year) ?? currentYear;
  const prevYear = year - 1;
  const hasPrev = year > MIN_YEAR;
  const hasNext = year < maxYear;

  const supabase = createSupabaseAdminClient();
  const thisYearStart = `${year}-01-01`;
  const thisYearEnd = `${year}-12-31`;
  const prevYearStart = `${prevYear}-01-01`;
  const prevYearEnd = `${prevYear}-12-31`;

  const [thisYear, lastYear, monthly, coachRows, captainRows, potwRows, playerRows] = await Promise.all([
    getRangeSummary(supabase, thisYearStart, thisYearEnd),
    getRangeSummary(supabase, prevYearStart, prevYearEnd),
    getMonthlyTrend(supabase, thisYearStart, thisYearEnd),
    getCoachAttendance(supabase, thisYearStart, thisYearEnd),
    getCaptainLeaderboard(supabase, thisYearStart, thisYearEnd),
    getPotwLeaderboard(supabase, thisYearStart, thisYearEnd),
    getPlayerAttendance(supabase, thisYearStart, thisYearEnd),
  ]);

  // Index monthly rows by month index (0-11) so we can render a full 12 rows.
  const byMonth = new Map<number, typeof monthly[number]>();
  for (const m of monthly) {
    const monthIndex = Number(m.month_start.slice(5, 7)) - 1;
    byMonth.set(monthIndex, m);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <nav className="flex gap-2">
          {hasPrev ? (
            <Link
              href={`/admin/analytics?year=${prevYear}`}
              className="px-3 py-1 border border-line rounded no-underline text-fg-muted hover:bg-surface"
            >
              <ArrowLeft /> {prevYear}
            </Link>
          ) : (
            <span
              className="px-3 py-1 border border-line rounded text-fg-muted opacity-50"
              aria-disabled="true"
            >
              <ArrowLeft /> {prevYear}
            </span>
          )}
          <span className="px-3 py-1 border border-line rounded bg-surface font-semibold">
            {year}
          </span>
          {hasNext ? (
            <Link
              href={`/admin/analytics?year=${year + 1}`}
              className="px-3 py-1 border border-line rounded no-underline text-fg-muted hover:bg-surface"
            >
              {year + 1} <ArrowRight />
            </Link>
          ) : (
            <span
              className="px-3 py-1 border border-line rounded text-fg-muted opacity-50"
              aria-disabled="true"
            >
              {year + 1} <ArrowRight />
            </span>
          )}
        </nav>
      </div>

      <p className="text-sm text-fg-muted">
        A session is one date+time. If two groups run at the same time (e.g. Foundation 09:00 + Development 09:00),
        they count as one session with totals summed across groups.
      </p>

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Sessions" value={thisYear.slots_count} prev={lastYear.slots_count} />
        <Kpi label="Groups" value={thisYear.sessions_count} prev={lastYear.sessions_count} />
        <Kpi label="Total players" value={thisYear.total_players} prev={lastYear.total_players} />
        <Kpi label="Avg / session" value={thisYear.avg_players_slot} prev={lastYear.avg_players_slot} decimals={2} />
        <Kpi label="Max / session" value={thisYear.max_players_slot} prev={lastYear.max_players_slot} />
        <Kpi label="Ghosts" value={thisYear.ghost_players} prev={lastYear.ghost_players} muted />
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">Monthly breakdown</h2>
        <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Sessions</th>
              <th>Players</th>
              <th>Avg / session</th>
              <th>Attended</th>
              <th>Ghosts</th>
            </tr>
          </thead>
          <tbody>
            {MONTH_NAMES.map((name, i) => {
              const row = byMonth.get(i);
              return (
                <tr key={name}>
                  <td>{name} {year}</td>
                  <td>{row?.slots_count ?? 0}</td>
                  <td>{row?.total_players ?? 0}</td>
                  <td>{(row?.avg_players_slot ?? 0).toFixed?.(2) ?? '0.00'}</td>
                  <td>{row?.attended_players ?? 0}</td>
                  <td>{row?.ghost_players ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        <LeaderboardTable
          title={`Captains - ${year}`}
          rows={captainRows}
          emptyHint="No captains recorded this year."
        />
        <LeaderboardTable
          title={`Player of the Week - ${year}`}
          rows={potwRows}
          emptyHint="No POTW recorded this year."
        />
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <CoachAttendanceTable rows={coachRows} year={year} />
        <PlayerAttendanceTable rows={playerRows} year={year} />
      </div>

      <p className="text-xs text-fg-muted">
        Totals count active bookings. Attended counts only those marked Present on the session report.
      </p>
    </div>
  );
}

function CoachAttendanceTable({ rows, year }: { rows: CoachAttendanceRow[]; year: number }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-bold">Coach attendance - {year}</h2>
      {rows.length === 0 ? (
        <p className="text-fg-muted text-sm">No coaches linked to sessions in this year.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Coach</th>
              <th>Sessions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.coach_id}>
                <td>{r.coach_name}</td>
                <td>{r.session_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function PlayerAttendanceTable({ rows, year }: { rows: PlayerAttendanceRow[]; year: number }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-bold">Player attendance - {year}</h2>
      {rows.length === 0 ? (
        <p className="text-fg-muted text-sm">No attendance recorded this year.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Attendances</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.player_key}>
                <td>
                  {r.player_name}
                  {r.is_ghost && <span className="ml-1.5 text-xs text-fg-muted/70">(ghost)</span>}
                </td>
                <td>{r.attendance_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function LeaderboardTable({
  title,
  rows,
  emptyHint,
}: {
  title: string;
  rows: AwardLeaderboardRow[];
  emptyHint: string;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-bold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-fg-muted text-sm">{emptyHint}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Awards</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.player_key}>
                <td>
                  {r.player_name}
                  {r.is_ghost && <span className="ml-1.5 text-xs text-fg-muted/70">(ghost)</span>}
                </td>
                <td>{r.award_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Kpi({
  label,
  value,
  prev,
  decimals = 0,
  muted = false,
}: {
  label: string;
  value: number;
  prev: number;
  decimals?: number;
  muted?: boolean;
}) {
  const delta = value - prev;
  const pct = prev > 0 ? (delta / prev) * 100 : null;
  const deltaSign = delta > 0 ? '+' : '';
  const deltaCls = delta > 0 ? 'text-[var(--ok-fg)]' : delta < 0 ? 'text-[var(--danger-fg)]' : 'text-fg-muted';
  const formattedValue = decimals > 0 ? value.toFixed(decimals) : value;
  const formattedDelta = decimals > 0 ? Math.abs(delta).toFixed(decimals) : Math.abs(delta);

  return (
    <div className={`p-3 border border-line rounded ${muted ? 'bg-surface-2' : 'bg-surface'}`}>
      <div className="text-xs uppercase tracking-wide text-fg-muted">{label}</div>
      <div className="text-2xl font-bold mt-1">{formattedValue}</div>
      <div className={`text-xs mt-1 ${deltaCls}`}>
        {delta === 0
          ? 'No change vs last year'
          : `${deltaSign}${delta > 0 ? formattedDelta : `−${formattedDelta}`}${pct !== null ? ` (${deltaSign}${pct.toFixed(0)}%)` : ''} vs last year`}
      </div>
    </div>
  );
}

function parseYear(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (n < MIN_YEAR || n > 2100) return null;
  return Math.floor(n);
}

// Force this page to read fresh data per request (no static rendering).
export const dynamic = 'force-dynamic';

// (RangeSummary import retained for type re-use if extended later.)
export type { RangeSummary };
