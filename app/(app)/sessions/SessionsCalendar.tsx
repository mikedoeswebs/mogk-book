'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { formatTime, formatPence } from '@/lib/format';
import { ArrowLeft, ArrowRight } from '@/lib/ui/Icon';
import type { Session } from '@/lib/db/types';
import { PendingButton } from '@/lib/ui/PendingButton';
import { addToSelection } from './selection-actions';

type Props = {
  sessions: Session[];
  remainingBySession: Map<string, number>;
  monthYM: string;
  todayISO: string;
  selectionCounts: Map<string, number>;
};

type OpenState = {
  iso: string;
  anchor: { top: number; left: number; right: number; bottom: number; width: number };
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function SessionsCalendar({
  sessions,
  remainingBySession,
  monthYM,
  todayISO,
  selectionCounts,
}: Props) {
  const [open, setOpen] = useState<OpenState | null>(null);
  const [nowMs] = useState(() => Date.now());

  const [year, month] = monthYM.split('-').map(Number);
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const lastOfMonth = new Date(Date.UTC(year, month, 0));
  const daysInMonth = lastOfMonth.getUTCDate();
  const firstWeekdayMon = (firstOfMonth.getUTCDay() + 6) % 7;

  const cells: { iso: string; day: number; inMonth: boolean }[] = [];
  const prevMonthLast = new Date(Date.UTC(year, month - 1, 0));
  const prevDays = prevMonthLast.getUTCDate();
  for (let i = firstWeekdayMon - 1; i >= 0; i--) {
    const d = prevDays - i;
    cells.push({ iso: toISO(new Date(Date.UTC(year, month - 2, d))), day: d, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ iso: toISO(new Date(Date.UTC(year, month - 1, d))), day: d, inMonth: true });
  }
  let nextDay = 1;
  while (cells.length < 42) {
    cells.push({ iso: toISO(new Date(Date.UTC(year, month, nextDay))), day: nextDay, inMonth: false });
    nextDay++;
  }

  const byDate = new Map<string, Session[]>();
  for (const s of sessions) {
    const list = byDate.get(s.date) ?? [];
    list.push(s);
    byDate.set(s.date, list);
  }

  const prevYM = shiftMonth(monthYM, -1);
  const nextYM = shiftMonth(monthYM, +1);
  const todayYM = todayISO.slice(0, 7);
  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  function handleDayClick(iso: string, target: HTMLElement) {
    const r = target.getBoundingClientRect();
    setOpen({
      iso,
      anchor: { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width },
    });
  }

  const openSessions = open ? (byDate.get(open.iso) ?? []) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">{monthLabel}</h2>
        <nav className="flex gap-2">
          <Link
            href={`/sessions?view=calendar&month=${prevYM}`}
            className="px-3 py-1 border border-line rounded no-underline text-fg hover:bg-surface-2"
            aria-label="Previous month"
          >
            <ArrowLeft />
          </Link>
          <Link
            href={`/sessions?view=calendar&month=${todayYM}`}
            className="px-3 py-1 border border-line rounded no-underline text-fg hover:bg-surface-2"
          >
            Today
          </Link>
          <Link
            href={`/sessions?view=calendar&month=${nextYM}`}
            className="px-3 py-1 border border-line rounded no-underline text-fg hover:bg-surface-2"
            aria-label="Next month"
          >
            <ArrowRight />
          </Link>
        </nav>
      </div>

      <div className="border border-line rounded overflow-hidden">
        <div className="grid grid-cols-7 bg-surface-2 border-b border-line text-xs sm:text-sm">
          {WEEKDAYS.map((w) => (
            <div key={w} className="px-2 py-2 text-center font-heading uppercase tracking-wider font-semibold text-fg-muted">
              <span className="hidden sm:inline">{w}</span>
              <span className="sm:hidden">{w.charAt(0)}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((cell, i) => {
            const sessionsToday = byDate.get(cell.iso) ?? [];
            const isToday = cell.iso === todayISO;
            const isPastDay = cell.iso < todayISO;
            const isOpen = open?.iso === cell.iso;
            const hasSessions = sessionsToday.length > 0;
            const allPast = hasSessions && sessionsToday.every((s) => new Date(s.starts_at).getTime() <= nowMs);

            const baseCellCls = [
              'min-h-[72px] sm:min-h-[110px] p-1 sm:p-2 border-b border-r border-line text-left',
              i % 7 === 6 ? 'border-r-0' : '',
              i >= 35 ? 'border-b-0' : '',
              !cell.inMonth ? 'text-fg-muted opacity-50' : '',
              isPastDay || allPast ? 'opacity-60' : '',
              isOpen ? 'ring-2 ring-accent ring-inset z-10' : '',
            ].join(' ');

            const numberCls = [
              'inline-flex items-center justify-center text-xs sm:text-sm leading-none w-6 h-6 rounded-full',
              isToday ? 'bg-accent text-accent-ink font-semibold' : 'text-fg',
              !cell.inMonth ? 'text-fg-muted' : '',
            ].join(' ');

            const dayNumber = (
              <div className="flex items-center justify-between">
                <span className={numberCls}>{cell.day}</span>
                {hasSessions && (
                  <span className="sm:hidden inline-block w-1.5 h-1.5 rounded-full bg-accent" aria-hidden />
                )}
              </div>
            );

            if (!hasSessions) {
              return (
                <div key={cell.iso + '-' + i} className={baseCellCls}>
                  {dayNumber}
                </div>
              );
            }

            const visible = sessionsToday.slice(0, 3);
            const overflow = sessionsToday.length - visible.length;

            return (
              <div
                key={cell.iso + '-' + i}
                role="button"
                tabIndex={0}
                onClick={(e) => handleDayClick(cell.iso, e.currentTarget)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleDayClick(cell.iso, e.currentTarget);
                  }
                }}
                className={`${baseCellCls} hover:bg-surface-2 focus:outline-none focus-visible:bg-surface-2 cursor-pointer`}
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                aria-label={`${sessionsToday.length} session${sessionsToday.length === 1 ? '' : 's'} on ${cell.iso}`}
              >
                {dayNumber}
                <div className="hidden sm:block mt-1.5 space-y-1 pointer-events-none">
                  {visible.map((s) => {
                    const remaining = remainingBySession.get(s.id) ?? s.capacity;
                    const full = remaining <= 0;
                    const sPast = new Date(s.starts_at).getTime() <= nowMs;
                    const cls = sPast
                      ? 'bg-surface-2 text-fg-muted'
                      : full
                      ? 'bg-surface-2 text-fg-muted line-through'
                      : 'bg-accent text-accent-ink';
                    return (
                      <div
                        key={s.id}
                        className={`${cls} text-xs leading-tight px-1.5 py-0.5 rounded truncate`}
                      >
                        <span className="font-semibold">{formatTime(s.start_time)}</span>
                        {s.age_group ? <span className="opacity-80"> {s.age_group}</span> : ''}
                      </div>
                    );
                  })}
                  {overflow > 0 && (
                    <div className="text-xs text-fg-muted px-1.5">+{overflow} more</div>
                  )}
                </div>
                <div className="sm:hidden mt-1 text-[10px] text-fg-muted pointer-events-none">
                  {sessionsToday.length} session{sessionsToday.length === 1 ? '' : 's'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {open && (
        <DayPopover
          iso={open.iso}
          anchor={open.anchor}
          sessions={openSessions}
          remainingBySession={remainingBySession}
          selectionCounts={selectionCounts}
          nowMs={nowMs}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function DayPopover({
  iso,
  anchor,
  sessions,
  remainingBySession,
  selectionCounts,
  nowMs,
  onClose,
}: {
  iso: string;
  anchor: OpenState['anchor'];
  sessions: Session[];
  remainingBySession: Map<string, number>;
  selectionCounts: Map<string, number>;
  nowMs: number;
  onClose: () => void;
}) {
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; ready: boolean }>({
    top: 0,
    left: 0,
    ready: false,
  });

  useLayoutEffect(() => {
    if (!popRef.current) return;
    const pop = popRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;

    let top = anchor.bottom + 6;
    let left = anchor.left;

    if (top + pop.height > vh - margin) {
      const above = anchor.top - pop.height - 6;
      if (above >= margin) {
        top = above;
      } else {
        top = Math.max(margin, vh - pop.height - margin);
      }
    }
    if (left + pop.width > vw - margin) left = vw - pop.width - margin;
    if (left < margin) left = margin;

    setPos({ top, left, ready: true });
  }, [anchor]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function onPointer(e: MouseEvent) {
      if (!popRef.current) return;
      if (popRef.current.contains(e.target as Node)) return;
      onClose();
    }
    function onScrollOrResize() {
      onClose();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [onClose]);

  const sorted = [...sessions].sort((a, b) => a.start_time.localeCompare(b.start_time));

  return (
    <div
      ref={popRef}
      role="dialog"
      aria-label={`Sessions on ${formatLongDate(iso)}`}
      style={{
        top: pos.top,
        left: pos.left,
        opacity: pos.ready ? 1 : 0,
      }}
      className="fixed z-50 w-[min(320px,calc(100vw-16px))] bg-surface border border-line rounded-md shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-3 transition-opacity"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-bold text-sm">{formatLongDate(iso)}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-fg-muted hover:text-fg leading-none p-0.5 -m-0.5 border-0 bg-transparent"
        >
          ✕
        </button>
      </div>
      <ul className="divide-y divide-line">
        {sorted.map((s) => {
          const remaining = remainingBySession.get(s.id) ?? s.capacity;
          const full = remaining <= 0;
          const sPast = new Date(s.starts_at).getTime() <= nowMs;
          const inSelection = selectionCounts.get(s.id) ?? 0;
          return (
            <li key={s.id} className={`py-2 ${sPast ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm">
                    {formatTime(s.start_time)}–{formatTime(s.end_time)}
                    {s.age_group && <span className="text-fg-muted"> | {s.age_group}</span>}
                  </div>
                  <div className="text-xs text-fg-muted">
                    {formatPence(s.price_pence)} |{' '}
                    {sPast
                      ? 'Passed'
                      : full
                      ? 'Sold out'
                      : `${remaining} of ${s.capacity} spots`}
                  </div>
                </div>
                <div className="ml-auto shrink-0">
                  {sPast || full ? (
                    <span className="text-sm text-fg-muted">-</span>
                  ) : (
                    <Link
                      href={`/sessions/${s.id}`}
                      className="text-sm bg-accent text-accent-ink no-underline font-semibold px-2 py-1 rounded hover:bg-accent-hover"
                    >
                      Info
                    </Link>
                  )}
                </div>
              </div>
              {!sPast && !full && (
                <form action={addToSelection} className="mt-1.5">
                  <input type="hidden" name="session_id" value={s.id} />
                  <PendingButton
                    className={
                      inSelection > 0
                        ? 'bg-transparent border border-accent text-accent text-xs font-normal py-0.5 px-2'
                        : 'bg-transparent border border-line text-fg-muted hover:text-fg hover:border-fg-muted text-xs font-normal py-0.5 px-2'
                    }
                  >
                    {inSelection > 0
                      ? `+ Add another (${inSelection} already)`
                      : '+ Add to selection'}
                  </PendingButton>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
}

function formatLongDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
