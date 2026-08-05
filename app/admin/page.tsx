import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatPence, formatTime } from '@/lib/format';
import { getPlayerAttendance, type PlayerAttendanceRow } from '@/lib/admin/analytics';

const ALL_TIME_START = '2000-01-01';
const ALL_TIME_END = '2999-12-31';

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// A "session" in this UI = a date+time slot. Multiple age-group rows in the DB
// sessions table that share the same (date, start_time) collapse to one
// session here.
type SlotRow = { id: string; date: string; start_time: string; end_time: string; age_group: string | null };
type BookingAmount = {
  status: 'active' | 'awaiting_approval';
  amount_pence: number;
  booking_fee_pence: number;
};

function countSlots(rows: SlotRow[]): number {
  const keys = new Set<string>();
  for (const r of rows) keys.add(`${r.date}|${r.start_time}`);
  return keys.size;
}

function sumNetRevenue(rows: BookingAmount[]): number {
  return rows.reduce(
    (s, b) => s + (b.amount_pence ?? 0) - (b.booking_fee_pence ?? 0),
    0,
  );
}

export default async function AdminDashboardPage() {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const now = new Date();
  const year = now.getFullYear();
  const monthIndex = now.getMonth();
  const today = now.toISOString().slice(0, 10);
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const monthStart = `${year}-${pad2(monthIndex + 1)}-01`;
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const monthEnd = `${year}-${pad2(monthIndex + 1)}-${pad2(lastDay)}`;
  const monthLabel = `${MONTH_LABELS[monthIndex]} ${year}`;

  const [
    { count: allActiveBookings },
    { count: pendingApprovals },
    { data: monthRows },
    { data: upcomingRows },
  ] = await Promise.all([
    supabase.from('bookings').select('*', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase.from('bookings').select('*', { count: 'exact', head: true })
      .eq('status', 'awaiting_approval'),
    supabase.from('sessions').select('id, date, start_time')
      .eq('status', 'open')
      .gte('date', monthStart).lte('date', monthEnd)
      .returns<SlotRow[]>(),
    supabase.from('sessions').select('id, date, start_time, end_time, age_group')
      .eq('status', 'open')
      .gte('date', today)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
      .returns<SlotRow[]>(),
  ]);

  const monthSessionRows = monthRows ?? [];
  const upcomingSessionRows = upcomingRows ?? [];
  const monthIds = monthSessionRows.map((r) => r.id);
  const upcomingIds = upcomingSessionRows.map((r) => r.id);

  const [monthBookings, upcomingBookings, topAttendance] = await Promise.all([
    monthIds.length === 0
      ? Promise.resolve([] as BookingAmount[])
      : supabase.from('bookings')
          .select('status, amount_pence, booking_fee_pence')
          .in('status', ['active', 'awaiting_approval'])
          .in('session_id', monthIds)
          .returns<BookingAmount[]>()
          .then((r) => r.data ?? []),
    upcomingIds.length === 0
      ? Promise.resolve([] as BookingAmount[])
      : supabase.from('bookings')
          .select('status, amount_pence, booking_fee_pence')
          .in('status', ['active', 'awaiting_approval'])
          .in('session_id', upcomingIds)
          .returns<BookingAmount[]>()
          .then((r) => r.data ?? []),
    getPlayerAttendance(supabase, ALL_TIME_START, ALL_TIME_END),
  ]);

  const monthSessionsCount = countSlots(monthSessionRows);
  const upcomingSessionsCount = countSlots(upcomingSessionRows);
  // Booking counts use confirmed bookings only so the card numbers line up
  // with what the linked /admin/bookings?status=active page shows. Revenue
  // still includes awaiting_approval as a forecast.
  const monthBookingCount = monthBookings.filter((b) => b.status === 'active').length;
  const monthRevenue = sumNetRevenue(monthBookings);
  const upcomingBookingCount = upcomingBookings.filter((b) => b.status === 'active').length;
  const upcomingRevenue = sumNetRevenue(upcomingBookings);

  // Find the next session slot (earliest date+time) and gather its groups.
  let nextSlot: { date: string; start_time: string; end_time: string } | null = null;
  const nextSlotGroups: SlotRow[] = [];
  for (const r of upcomingSessionRows) {
    if (
      !nextSlot ||
      r.date < nextSlot.date ||
      (r.date === nextSlot.date && r.start_time < nextSlot.start_time)
    ) {
      nextSlot = { date: r.date, start_time: r.start_time, end_time: r.end_time };
    }
  }
  if (nextSlot) {
    for (const r of upcomingSessionRows) {
      if (r.date === nextSlot.date && r.start_time === nextSlot.start_time) {
        nextSlotGroups.push(r);
      }
    }
    nextSlotGroups.sort((a, b) => (b.age_group ?? '').localeCompare(a.age_group ?? ''));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/sessions/new"
            className="inline-block bg-accent text-accent-ink font-semibold no-underline px-4 py-2 rounded hover:bg-accent-hover"
          >
            + New session
          </Link>
          <Link
            href="/admin/bookings/new"
            className="inline-block bg-surface border border-line text-fg font-semibold no-underline px-4 py-2 rounded hover:bg-surface-2"
          >
            + New booking
          </Link>
        </div>
      </div>

      {nextSlot && nextSlotGroups.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-heading uppercase tracking-wider text-sm text-fg-muted">
            Next session
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-fg-muted whitespace-nowrap">
              {formatNextSessionDate(nextSlot.date)}&nbsp;&middot;&nbsp;
              {formatTime(nextSlot.start_time)}–{formatTime(nextSlot.end_time)}
            </span>
            <Link
              href={`/admin/sessions/${nextSlotGroups[0].id}/register`}
              className="inline-block bg-accent text-accent-ink font-semibold no-underline px-3 py-1.5 rounded text-sm hover:bg-accent-hover"
            >
              Register &rarr;
            </Link>
            {nextSlotGroups.map((r) => (
              <Link
                key={r.id}
                href={`/admin/sessions/${r.id}/edit`}
                className="inline-block bg-surface border border-line text-fg font-semibold no-underline px-3 py-1.5 rounded text-sm hover:bg-surface-2"
              >
                {r.age_group ?? 'Group'} &rarr;
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-heading uppercase tracking-wider text-sm text-fg-muted">
          {monthLabel}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card label="Sessions this month" value={monthSessionsCount} href="/admin/sessions" />
          <Card label="Bookings this month" value={monthBookingCount} />
          <Card label="Revenue this month" value={formatPence(monthRevenue)} />
          <Card
            label="Pending approvals"
            value={pendingApprovals ?? 0}
            href="/admin/approvals"
            highlight={Boolean(pendingApprovals)}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading uppercase tracking-wider text-sm text-fg-muted">
          Looking ahead
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card label="Upcoming sessions" value={upcomingSessionsCount} href="/admin/sessions" />
          <Card label="Upcoming bookings" value={upcomingBookingCount} href="/admin/bookings?status=active" />
          <Card label="Forecast revenue" value={formatPence(upcomingRevenue)} />
          <Card label="All-time active" value={allActiveBookings ?? 0} href="/admin/bookings?status=active" />
        </div>
      </section>

      <TopAttendanceSection rows={topAttendance} />
    </div>
  );
}

function TopAttendanceSection({ rows }: { rows: PlayerAttendanceRow[] }) {
  const topRows = rows.slice(0, 10);
  const restRows = rows.slice(10);

  return (
    <section className="space-y-3">
      <h2 className="font-heading uppercase tracking-wider text-sm text-fg-muted">
        Attendances (all time)
      </h2>
      {rows.length === 0 ? (
        <p className="text-fg-muted text-sm">No attendance recorded yet.</p>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Attendances</th>
              </tr>
            </thead>
            <tbody>
              {topRows.map((r) => (
                <AttendanceRow key={r.player_key} row={r} />
              ))}
            </tbody>
          </table>
          {restRows.length > 0 && (
            <details className="border border-line rounded bg-surface">
              <summary className="cursor-pointer px-3 py-2 font-heading uppercase tracking-wide text-sm font-bold select-none">
                Show {restRows.length} more
              </summary>
              <table>
                <thead className="sr-only">
                  <tr>
                    <th>Player</th>
                    <th>Attendances</th>
                  </tr>
                </thead>
                <tbody>
                  {restRows.map((r) => (
                    <AttendanceRow key={r.player_key} row={r} />
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </>
      )}
    </section>
  );
}

function AttendanceRow({ row }: { row: PlayerAttendanceRow }) {
  return (
    <tr>
      <td>
        {row.player_name}
        {row.is_ghost && <span className="ml-1.5 text-xs text-fg-muted/70">(ghost)</span>}
      </td>
      <td>{row.attendance_count}</td>
    </tr>
  );
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatNextSessionDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

function Card({
  label,
  value,
  href,
  highlight,
}: {
  label: string;
  value: number | string;
  href?: string;
  highlight?: boolean;
}) {
  const inner = (
    <div
      className={`p-4 border border-line rounded ${highlight ? 'bg-[var(--warn-bg)] border-[var(--warn-line)] text-[var(--warn-fg)]' : 'bg-surface'}`}
    >
      <div className="text-sm text-fg-muted">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
