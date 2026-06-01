import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatTime, formatPence } from '@/lib/format';
import { sessionIsPast } from '@/lib/booking/rules';
import { ArrowLeft, ArrowRight } from '@/lib/ui/Icon';
import type { Session } from '@/lib/db/types';

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseYear(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 2020 || n > 2100) return null;
  return Math.floor(n);
}

type Slot = {
  key: string;            // date|start_time
  date: string;
  start_time: string;
  end_time: string;
  sessions: Session[];    // one row per age_group sharing this slot
};

export default async function AdminSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const supabase = createSupabaseAdminClient();

  const currentYear = new Date().getUTCFullYear();
  const year = parseYear(sp.year) ?? currentYear;
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const [{ data: sessions }, { data: earliest }, { data: latest }] = await Promise.all([
    supabase
      .from('sessions')
      .select('*')
      .gte('date', yearStart)
      .lte('date', yearEnd)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
      .returns<Session[]>(),
    supabase
      .from('sessions')
      .select('date')
      .order('date', { ascending: true })
      .limit(1)
      .returns<{ date: string }[]>(),
    supabase
      .from('sessions')
      .select('date')
      .order('date', { ascending: false })
      .limit(1)
      .returns<{ date: string }[]>(),
  ]);

  const earliestYear = earliest && earliest[0] ? Number(earliest[0].date.slice(0, 4)) : currentYear;
  const latestYear = latest && latest[0] ? Number(latest[0].date.slice(0, 4)) : currentYear;
  const hasPrev = year > earliestYear;
  const hasNext = year < latestYear;

  const ids = (sessions ?? []).map((s) => s.id);
  const remainingBySession = new Map<string, number>();
  const takenBySession = new Map<string, number>();
  if (ids.length > 0) {
    const { data: avail } = await supabase.rpc('get_session_availability', {
      p_session_ids: ids,
    });
    for (const a of (avail ?? []) as { session_id: string; taken: number; remaining: number }[]) {
      remainingBySession.set(a.session_id, a.remaining);
      takenBySession.set(a.session_id, a.taken);
    }
  }

  // Group by month, then by slot (date+start_time).
  type MonthBlock = {
    monthKey: string;
    monthLabel: string;
    slots: Slot[];
  };
  const blocks: MonthBlock[] = [];
  const blockByMonth = new Map<string, MonthBlock>();
  const slotByMonthKey = new Map<string, Map<string, Slot>>();

  for (const s of sessions ?? []) {
    const monthKey = s.date.slice(0, 7);
    let block = blockByMonth.get(monthKey);
    if (!block) {
      block = {
        monthKey,
        monthLabel: `${MONTH_LABELS[Number(monthKey.slice(5, 7)) - 1]} ${monthKey.slice(0, 4)}`,
        slots: [],
      };
      blocks.push(block);
      blockByMonth.set(monthKey, block);
      slotByMonthKey.set(monthKey, new Map());
    }
    const slotMap = slotByMonthKey.get(monthKey)!;
    const slotKey = `${s.date}|${s.start_time}`;
    let slot = slotMap.get(slotKey);
    if (!slot) {
      slot = {
        key: slotKey,
        date: s.date,
        start_time: s.start_time,
        end_time: s.end_time,
        sessions: [],
      };
      slotMap.set(slotKey, slot);
      block.slots.push(slot);
    }
    slot.sessions.push(s);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Sessions</h1>
        <Link href="/admin/sessions/new">+ New session</Link>
      </div>

      <nav className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-heading uppercase tracking-wider text-sm text-fg-muted">
          {year}
        </span>
        <div className="flex gap-2">
          {hasPrev ? (
            <Link
              href={`/admin/sessions?year=${year - 1}`}
              className="px-3 py-1 border border-line rounded no-underline! text-fg! hover:bg-surface-2"
              aria-label={`Previous year (${year - 1})`}
            >
              <ArrowLeft /> {year - 1}
            </Link>
          ) : (
            <span className="px-3 py-1 border border-line rounded text-fg-muted opacity-50">
              <ArrowLeft /> {year - 1}
            </span>
          )}
          {hasNext ? (
            <Link
              href={`/admin/sessions?year=${year + 1}`}
              className="px-3 py-1 border border-line rounded no-underline! text-fg! hover:bg-surface-2"
              aria-label={`Next year (${year + 1})`}
            >
              {year + 1} <ArrowRight />
            </Link>
          ) : (
            <span className="px-3 py-1 border border-line rounded text-fg-muted opacity-50">
              {year + 1} <ArrowRight />
            </span>
          )}
        </div>
      </nav>

      {!sessions || sessions.length === 0 ? (
        <p className="text-fg-muted">No sessions in {year}.</p>
      ) : (
        blocks.map((block) => (
          <section
            key={block.monthKey}
            className="space-y-2 pt-2 pb-4"
          >
            <h2 className="text-xl font-bold">{block.monthLabel}</h2>
            <div className="overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="hidden sm:table-cell">Time</th>
                  <th className="hidden sm:table-cell">Coach</th>
                  <th className="hidden sm:table-cell">Groups</th>
                  <th className="hidden sm:table-cell">Price</th>
                  <th className="hidden sm:table-cell">Bookings</th>
                  <th className="hidden sm:table-cell">Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {block.slots.map((slot) => (
                  <SlotRow
                    key={slot.key}
                    slot={slot}
                    takenBySession={takenBySession}
                  />
                ))}
              </tbody>
            </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function SlotRow({
  slot,
  takenBySession,
}: {
  slot: Slot;
  takenBySession: Map<string, number>;
}) {
  // Sort the sessions within a slot Z-A by age_group so the order is
  // deterministic across rows (Main before Academy, etc.).
  const sessions = [...slot.sessions].sort((a, b) =>
    (b.age_group ?? '').localeCompare(a.age_group ?? ''),
  );

  const past = sessionIsPast(sessions[0]);

  const dateLabel = formatShortDate(slot.date);
  const timeLabel = `${formatTime(slot.start_time)}–${formatTime(slot.end_time)}`;

  const coaches = uniq(sessions.map((s) => s.coach_name));
  const prices = uniq(sessions.map((s) => s.price_pence));
  const statuses = uniq(sessions.map((s) => s.status));

  return (
    <tr className={past ? 'opacity-70' : ''}>
      <td className="whitespace-nowrap align-top">{dateLabel}</td>
      <td className="hidden sm:table-cell whitespace-nowrap align-top">{timeLabel}</td>
      <td className="hidden sm:table-cell align-top">
        {coaches.map((c) => <div key={c}>{c}</div>)}
      </td>
      <td className="hidden sm:table-cell align-top">
        {sessions.map((s) => (
          <div key={s.id}>{s.age_group ?? '-'}</div>
        ))}
      </td>
      <td className="hidden sm:table-cell align-top">
        {prices.map((p) => <div key={p}>{formatPence(p)}</div>)}
      </td>
      <td className="hidden sm:table-cell align-top">
        {sessions.map((s) => {
          const taken = takenBySession.get(s.id) ?? 0;
          return (
            <div key={s.id} title={s.age_group ?? undefined}>
              {taken}/{s.capacity}
            </div>
          );
        })}
      </td>
      <td className="hidden sm:table-cell align-top capitalize">
        {statuses.map((st) => <div key={st}>{st}</div>)}
      </td>
      <td className="whitespace-nowrap text-right align-top">
        <ul>
          {sessions.map((s) => (
            <li key={s.id}>
              <span className="text-fg-muted mr-2">{s.age_group ?? '-'}:</span>{' '}
              <Link href={`/admin/sessions/${s.id}/edit`}>Edit</Link>
              {past && (
                <>
                  <span className="text-fg-muted"> | </span>
                  <Link href={`/admin/sessions/${s.id}/report`}>Report</Link>
                </>
              )}
            </li>
          ))}
        </ul>
      </td>
    </tr>
  );
}

function uniq<T>(arr: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const v of arr) {
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

function formatShortDate(iso: string): string {
  // The Date is constructed in *local* time (no Z suffix on the ISO string), so
  // we must read it back with local getters. Using getUTCDay/getUTCDate would
  // shift the calendar date back by one in BST (which begins 30 March 2026 in
  // the UK, triggering the "Mon 30 → Sun 29" bug we hit).
  const d = new Date(iso + 'T00:00:00');
  return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()}`;
}
