import Link from 'next/link';
import { requireParent } from '@/lib/auth/require-parent';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sessionIsPast } from '@/lib/booking/rules';
import { formatDate, formatTime, formatPence } from '@/lib/format';
import { ArrowLeft, ArrowRight } from '@/lib/ui/Icon';
import type { Session } from '@/lib/db/types';
import { getSelection } from '@/lib/booking/selection';
import { PendingButton } from '@/lib/ui/PendingButton';
import SessionsCalendar from './SessionsCalendar';
import { addToSelection } from './selection-actions';

type View = 'list' | 'calendar';

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; month?: string }>;
}) {
  await requireParent();
  const sp = await searchParams;
  const view: View = sp.view === 'calendar' ? 'calendar' : 'list';

  const supabase = await createSupabaseServerClient();
  const todayISO = new Date().toISOString().slice(0, 10);

  if (view === 'calendar') {
    const monthYM = isValidYM(sp.month) ? sp.month! : todayISO.slice(0, 7);
    const { rangeStart, rangeEnd } = monthRange(monthYM);

    const { data: sessions } = await supabase
      .from('sessions')
      .select('*')
      .eq('status', 'open')
      .gte('date', rangeStart)
      .lte('date', rangeEnd)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
      .returns<Session[]>();

    const ids = (sessions ?? []).map((s) => s.id);
    const remainingBySession = new Map<string, number>();
    if (ids.length > 0) {
      const { data: availability } = await supabase.rpc('get_session_availability', {
        p_session_ids: ids,
      });
      for (const a of (availability ?? []) as { session_id: string; remaining: number }[]) {
        remainingBySession.set(a.session_id, a.remaining);
      }
    }

    const selection = await getSelection();
    const selectionCounts = new Map<string, number>();
    for (const it of selection.items) {
      selectionCounts.set(it.sessionId, (selectionCounts.get(it.sessionId) ?? 0) + 1);
    }

    return (
      <div className="space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Sessions</h1>
          <ViewToggle current="calendar" monthYM={monthYM} />
        </header>

        <SessionsCalendar
          sessions={sessions ?? []}
          remainingBySession={remainingBySession}
          monthYM={monthYM}
          todayISO={todayISO}
          selectionCounts={selectionCounts}
        />
      </div>
    );
  }

  // ----- List view (2-month pages) -----
  const todayYM = todayISO.slice(0, 7);
  const windowStart = isValidYM(sp.month) && sp.month! >= todayYM ? sp.month! : todayYM;
  const windowEnd = shiftMonth(windowStart, 1);
  const rangeStart = `${windowStart}-01`;
  const rangeEnd = `${windowEnd}-${daysInMonth(windowEnd)}`;
  const effectiveStart = todayISO > rangeStart ? todayISO : rangeStart;

  const [
    { data: sessions },
    { data: hasNextRows },
  ] = await Promise.all([
    supabase
      .from('sessions')
      .select('*')
      .eq('status', 'open')
      .gte('date', effectiveStart)
      .lte('date', rangeEnd)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
      .returns<Session[]>(),
    supabase
      .from('sessions')
      .select('id')
      .eq('status', 'open')
      .gt('date', rangeEnd)
      .limit(1),
  ]);

  const hasPrev = windowStart > todayYM;
  const hasNext = (hasNextRows ?? []).length > 0;
  const prevYM = shiftMonth(windowStart, -2);
  const nextYM = shiftMonth(windowStart, 2);

  const ids = (sessions ?? []).map((s) => s.id);
  const remainingBySession = new Map<string, number>();
  if (ids.length > 0) {
    const { data: availability } = await supabase.rpc('get_session_availability', {
      p_session_ids: ids,
    });
    for (const a of (availability ?? []) as { session_id: string; remaining: number }[]) {
      remainingBySession.set(a.session_id, a.remaining);
    }
  }

  const selection = await getSelection();
  const selectionCounts = new Map<string, number>();
  for (const it of selection.items) {
    selectionCounts.set(it.sessionId, (selectionCounts.get(it.sessionId) ?? 0) + 1);
  }

  // Group by month, then by date within month - data already sorted.
  type MonthBlock = {
    monthKey: string;
    monthLabel: string;
    dates: { date: string; sessions: Session[] }[];
  };
  const blocks: MonthBlock[] = [];
  const blockByKey = new Map<string, MonthBlock>();
  const dateMapByMonth = new Map<string, Map<string, Session[]>>();

  for (const s of sessions ?? []) {
    const monthKey = s.date.slice(0, 7);
    let block = blockByKey.get(monthKey);
    if (!block) {
      block = {
        monthKey,
        monthLabel: `${MONTH_LABELS[Number(monthKey.slice(5, 7)) - 1]} ${monthKey.slice(0, 4)}`,
        dates: [],
      };
      blocks.push(block);
      blockByKey.set(monthKey, block);
      dateMapByMonth.set(monthKey, new Map());
    }
    const dateMap = dateMapByMonth.get(monthKey)!;
    let list = dateMap.get(s.date);
    if (!list) {
      list = [];
      dateMap.set(s.date, list);
      block.dates.push({ date: s.date, sessions: list });
    }
    list.push(s);
  }

  const windowLabel = formatWindowLabel(windowStart, windowEnd);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Sessions</h1>
        <ViewToggle current="list" monthYM={windowStart} />
      </header>

      <nav className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-heading uppercase tracking-wider text-sm text-fg-muted">
          {windowLabel}
        </span>
        <div className="flex gap-2">
          {hasPrev ? (
            <Link
              href={`/sessions?view=list&month=${prevYM}`}
              className="px-3 py-1 border border-line rounded no-underline text-fg hover:bg-surface-2"
              aria-label="Previous 2 months"
            >
              <ArrowLeft />
            </Link>
          ) : (
            <span
              className="px-3 py-1 border border-line rounded text-fg-muted opacity-50"
              aria-disabled="true"
            >
              <ArrowLeft />
            </span>
          )}
          {hasNext ? (
            <Link
              href={`/sessions?view=list&month=${nextYM}`}
              className="px-3 py-1 border border-line rounded no-underline text-fg hover:bg-surface-2"
              aria-label="Next 2 months"
            >
              <ArrowRight />
            </Link>
          ) : (
            <span
              className="px-3 py-1 border border-line rounded text-fg-muted opacity-50"
              aria-disabled="true"
            >
              <ArrowRight />
            </span>
          )}
        </div>
      </nav>

      {!sessions || sessions.length === 0 ? (
        <p className="text-fg-muted">
          No sessions in {windowLabel}.{' '}
          {hasNext && 'Try the next 2 months.'}
        </p>
      ) : (
        blocks.map((block) => (
          <section key={block.monthKey} className="space-y-3">
            <h2 className="text-xl font-bold pt-2">{block.monthLabel}</h2>

            <div className="hidden md:block overflow-x-auto"><table className="text-sm lg:text-base">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Group</th>
                  <th>Price</th>
                  <th>Availability</th>
                  <th></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {block.dates.map((d) => (
                  <DateGroup
                    key={d.date}
                    date={d.date}
                    sessions={d.sessions}
                    remainingBySession={remainingBySession}
                    selectionCounts={selectionCounts}
                  />
                ))}
              </tbody>
            </table></div>

            <div className="md:hidden space-y-5">
              {block.dates.map((d) => (
                <DateGroupMobile
                  key={d.date}
                  date={d.date}
                  sessions={d.sessions}
                  remainingBySession={remainingBySession}
                  selectionCounts={selectionCounts}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function formatWindowLabel(monthA: string, monthB: string): string {
  const yA = monthA.slice(0, 4);
  const yB = monthB.slice(0, 4);
  const mA = MONTH_LABELS[Number(monthA.slice(5, 7)) - 1];
  const mB = MONTH_LABELS[Number(monthB.slice(5, 7)) - 1];
  return yA === yB ? `${mA} – ${mB} ${yA}` : `${mA} ${yA} – ${mB} ${yB}`;
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function daysInMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return String(last).padStart(2, '0');
}

function DateGroup({
  date,
  sessions,
  remainingBySession,
  selectionCounts,
}: {
  date: string;
  sessions: Session[];
  remainingBySession: Map<string, number>;
  selectionCounts: Map<string, number>;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={6}
          className="bg-surface-2 font-heading font-medium text-sm text-fg-muted"
        >
          {formatDate(date)}
        </td>
      </tr>
      {sessions.map((s) => {
        const remaining = remainingBySession.get(s.id) ?? s.capacity;
        const past = sessionIsPast(s);
        const rowCls = past ? 'opacity-50' : '';
        const inSelection = selectionCounts.get(s.id) ?? 0;
        const bookable = !past && remaining > 0;
        return (
          <tr key={s.id} className={rowCls}>
            <td>
              {formatTime(s.start_time)}–{formatTime(s.end_time)}
            </td>
            <td>{s.age_group ?? '-'}</td>
            <td>{formatPence(s.price_pence)}</td>
            <td>
              {past
                ? 'Passed'
                : remaining > 0
                ? `${remaining} of ${s.capacity}`
                : 'Sold out'}
            </td>
            <td>
              {bookable ? (
                <Link href={`/sessions/${s.id}`}>Info</Link>
              ) : (
                <span className="text-fg-muted">-</span>
              )}
            </td>
            <td className="text-right w-[200px]">
              {bookable && (
                <form action={addToSelection}>
                  <input type="hidden" name="session_id" value={s.id} />
                  <PendingButton
                    className={
                      inSelection > 0
                        ? 'bg-transparent border border-accent text-accent text-sm font-normal transition-all whitespace-nowrap'
                        : 'bg-transparent border border-line text-fg hover:border-accent text-sm font-normal transition-all whitespace-nowrap'
                    }
                  >
                    {inSelection > 0 ? `+ Add More (${inSelection})` : '+ Add'}
                  </PendingButton>
                </form>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}

function DateGroupMobile({
  date,
  sessions,
  remainingBySession,
  selectionCounts,
}: {
  date: string;
  sessions: Session[];
  remainingBySession: Map<string, number>;
  selectionCounts: Map<string, number>;
}) {
  return (
    <div>
      <h3 className="bg-surface-2 px-3 py-1.5 font-heading font-medium text-sm text-fg-muted">
        {formatDate(date)}
      </h3>
      <ul className="space-y-2 mt-2">
        {sessions.map((s) => {
          const remaining = remainingBySession.get(s.id) ?? s.capacity;
          const past = sessionIsPast(s);
          const inSelection = selectionCounts.get(s.id) ?? 0;
          const bookable = !past && remaining > 0;
          const availability = past
            ? 'Passed'
            : remaining > 0
            ? `${remaining} of ${s.capacity} left`
            : 'Sold out';
          return (
            <li
              key={s.id}
              className={`p-3 border border-line rounded bg-surface ${past ? 'opacity-50' : ''}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-semibold">
                  {formatTime(s.start_time)}–{formatTime(s.end_time)}
                </p>
                <p className="text-sm whitespace-nowrap">{formatPence(s.price_pence)}</p>
              </div>
              <p className="text-xs text-fg-muted mt-0.5">
                {s.age_group ? `${s.age_group} · ` : ''}
                {availability}
              </p>
              {bookable && (
                <div className="flex items-center gap-3 mt-3">
                  <Link href={`/sessions/${s.id}`} className="text-sm">Info</Link>
                  <form action={addToSelection} className="ml-auto">
                    <input type="hidden" name="session_id" value={s.id} />
                    <PendingButton
                      className={
                        inSelection > 0
                          ? 'bg-transparent border border-accent text-accent text-sm font-normal transition-all whitespace-nowrap'
                          : 'bg-transparent border border-line text-fg hover:border-accent text-sm font-normal transition-all whitespace-nowrap'
                      }
                    >
                      {inSelection > 0 ? `+ Add More (${inSelection})` : '+ Add'}
                    </PendingButton>
                  </form>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ListIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      width="20"
      height="20"
      aria-hidden
    >
      <path d="M3 4H21V6H3V4ZM3 11H21V13H3V11ZM3 18H21V20H3V18Z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      width="20"
      height="20"
      aria-hidden
    >
      <path d="M9 1V3H15V1H17V3H21C21.5523 3 22 3.44772 22 4V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3H7V1H9ZM20 11H4V19H20V11ZM7 5H4V9H20V5H17V7H15V5H9V7H7V5Z" />
    </svg>
  );
}

function ViewToggle({ current, monthYM }: { current: View; monthYM: string }) {
  const baseCls = 'inline-flex items-center justify-center px-3 py-2 text-sm no-underline';
  const activeCls = 'bg-accent text-accent-ink';
  const inactiveCls = 'text-fg-muted hover:bg-surface-2';

  return (
    <div className="inline-flex border border-line rounded overflow-hidden" role="tablist">
      <Link
        href="/sessions?view=list"
        className={`${baseCls} ${current === 'list' ? activeCls : inactiveCls}`}
        role="tab"
        aria-selected={current === 'list'}
        aria-label="List view"
        title="List view"
      >
        <ListIcon />
      </Link>
      <Link
        href={`/sessions?view=calendar&month=${monthYM}`}
        className={`${baseCls} ${current === 'calendar' ? activeCls : inactiveCls}`}
        role="tab"
        aria-selected={current === 'calendar'}
        aria-label="Calendar view"
        title="Calendar view"
      >
        <CalendarIcon />
      </Link>
    </div>
  );
}

function isValidYM(s: string | undefined): s is string {
  return !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

function monthRange(ym: string): { rangeStart: string; rangeEnd: string } {
  const [y, m] = ym.split('-').map(Number);
  const firstOfMonth = new Date(Date.UTC(y, m - 1, 1));
  const firstWeekdayMon = (firstOfMonth.getUTCDay() + 6) % 7;
  const lastOfMonth = new Date(Date.UTC(y, m, 0));
  const trailingDays = 6 - ((lastOfMonth.getUTCDay() + 6) % 7);
  const start = new Date(firstOfMonth);
  start.setUTCDate(start.getUTCDate() - firstWeekdayMon);
  const end = new Date(lastOfMonth);
  end.setUTCDate(end.getUTCDate() + trailingDays);
  return {
    rangeStart: start.toISOString().slice(0, 10),
    rangeEnd: end.toISOString().slice(0, 10),
  };
}
