import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatPence } from '@/lib/format';

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// A "session" in this UI = a date+time slot. Multiple age-group rows in the DB
// sessions table that share the same (date, start_time) collapse to one
// session here.
type SlotRow = { id: string; date: string; start_time: string };
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
    supabase.from('sessions').select('id, date, start_time')
      .eq('status', 'open')
      .gte('date', today)
      .returns<SlotRow[]>(),
  ]);

  const monthSessionRows = monthRows ?? [];
  const upcomingSessionRows = upcomingRows ?? [];
  const monthIds = monthSessionRows.map((r) => r.id);
  const upcomingIds = upcomingSessionRows.map((r) => r.id);

  const [monthBookings, upcomingBookings] = await Promise.all([
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

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

      <p>
        <Link href="/admin/sessions/new">+ Create a new session</Link>
      </p>
    </div>
  );
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
