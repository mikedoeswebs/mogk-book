'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export type AgeCheckPlayer = { id: string; name: string; tooOld: boolean };

const TOO_OLD_NOTE = 'Sessions are for ages 16 and under';

/**
 * Player dropdown that marks itself invalid when an over-age player is picked,
 * so ValidatedSubmit keeps the button disabled. The server re-checks anyway.
 */
export function PlayerSelect({
  name,
  players,
  defaultValue,
  placeholder,
  className,
}: {
  name: string;
  players: AgeCheckPlayer[];
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSelectElement>(null);
  const [value, setValue] = useState(defaultValue ?? (placeholder ? '' : players[0]?.id ?? ''));
  const tooOld = players.some((p) => p.id === value && p.tooOld);

  // Layout effect so validity is set before ValidatedSubmit's first check.
  useLayoutEffect(() => {
    ref.current?.setCustomValidity(tooOld ? TOO_OLD_NOTE : '');
  }, [tooOld]);

  // Native listener on the select itself fires before the form-level
  // listeners in ValidatedSubmit, so they see the updated validity.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      el.setCustomValidity(players.some((p) => p.id === el.value && p.tooOld) ? TOO_OLD_NOTE : '');
      setValue(el.value);
    };
    el.addEventListener('input', update);
    el.addEventListener('change', update);
    return () => {
      el.removeEventListener('input', update);
      el.removeEventListener('change', update);
    };
  }, [players]);

  return (
    <>
      <select ref={ref} name={name} required defaultValue={defaultValue} className={className}>
        {placeholder && <option value="">{placeholder}</option>}
        {players.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      {tooOld && <div className="text-xs text-[var(--warn-fg)] mt-0.5">{TOO_OLD_NOTE}</div>}
    </>
  );
}

export type AgeCheckRow = {
  /** `name` of the PlayerSelect this row watches. */
  selectName: string;
  defaultChildId: string;
  /** Session date, YYYY-MM-DD, used to pick the earliest date per player. */
  date: string;
  /** e.g. "Saturday 14 November". */
  dateLabel: string;
  tooOldIds: string[];
};

/**
 * Friendly explanation shown once per over-age player currently selected
 * anywhere in the surrounding form.
 */
export function AgeWarning({
  rows,
  names,
}: {
  rows: AgeCheckRow[];
  names: Record<string, string>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.selectName, r.defaultChildId])),
  );

  useEffect(() => {
    const form = ref.current?.closest('form');
    if (!form) return;
    const update = () => {
      const next: Record<string, string> = {};
      for (const r of rows) {
        const el = form.elements.namedItem(r.selectName);
        next[r.selectName] = el instanceof HTMLSelectElement ? el.value : '';
      }
      setValues(next);
    };
    update();
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    return () => {
      form.removeEventListener('input', update);
      form.removeEventListener('change', update);
    };
  }, [rows]);

  // Earliest affected session per player.
  const byChild = new Map<string, AgeCheckRow>();
  for (const r of rows) {
    const childId = values[r.selectName];
    if (!childId || !r.tooOldIds.includes(childId)) continue;
    const seen = byChild.get(childId);
    if (!seen || r.date < seen.date) byChild.set(childId, r);
  }

  return (
    <div ref={ref} className="space-y-3 empty:hidden">
      {[...byChild].map(([childId, r]) => {
        const name = names[childId] ?? 'This player';
        return (
          <div
            key={childId}
            className="p-3 bg-[var(--warn-bg)] border border-[var(--warn-line)] text-[var(--warn-fg)] rounded space-y-1"
          >
            <p><strong>Sorry, {name} has aged out of our sessions</strong></p>
            <p>
              Our sessions are designed for goalkeepers aged 16 and under, and {name} will be 17
              by {r.dateLabel}. We&apos;ve loved having them with us, so thank you! If you think
              their date of birth is wrong, you can check it on the{' '}
              <Link href="/children">My players</Link> page, or just reply to any of our emails
              and we&apos;ll sort it out.
            </p>
          </div>
        );
      })}
    </div>
  );
}
