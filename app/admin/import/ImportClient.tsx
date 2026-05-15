'use client';

import { useState } from 'react';
import {
  parseCsvText,
  summarise,
  type HistoricParseResult,
  type HistoricSummary,
} from '@/lib/import/historic';
import { CoachMultiSelect } from '@/lib/ui/CoachMultiSelect';
import { ArrowRight } from '@/lib/ui/Icon';
import type { Coach } from '@/lib/db/types';
import { runImport } from './actions';

type Parsed = {
  result: HistoricParseResult;
  summary: HistoricSummary;
  fileName: string;
};

export function ImportClient({ coaches }: { coaches: Coach[] }) {
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [parsing, setParsing] = useState(false);

  async function handleFile(file: File | null) {
    if (!file) {
      setParsed(null);
      return;
    }
    setParsing(true);
    const text = await file.text();
    const result = parseCsvText(text);
    const summary = summarise(result.rows);
    setParsed({ result, summary, fileName: file.name });
    setParsing(false);
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3 max-w-xl">
        <label className="block border border-line rounded p-4 cursor-pointer hover:bg-surface-2">
          <span className="block mb-4 font-heading uppercase font-bold text-sm tracking-wide">
            Choose CSV
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-fg-muted file:mr-4 file:py-2 file:px-4 file:border file:border-line file:rounded file:text-sm file:font-heading file:uppercase file:tracking-wide hover:file:bg-surface-2 cursor-pointer"
          />
        </label>
        {parsing && <p className="text-fg-muted text-sm">Parsing…</p>}
      </section>

      {parsed && (
        <>
          <section className="space-y-2 p-4 border border-line rounded bg-surface">
            <h2 className="text-xl font-bold">Preview | {parsed.fileName}</h2>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-sm">
              <dt className="text-fg-muted">Valid rows</dt>
              <dd>{parsed.summary.totalRows}</dd>
              <dt className="text-fg-muted">Distinct players</dt>
              <dd>{parsed.summary.distinctPlayers}</dd>
              <dt className="text-fg-muted">Distinct dates</dt>
              <dd>{parsed.summary.distinctDates}</dd>
              <dt className="text-fg-muted">Date range</dt>
              <dd>
                {parsed.summary.earliestDate ?? '-'}
                {parsed.summary.latestDate && parsed.summary.latestDate !== parsed.summary.earliestDate && (
                  <>
                    {' '}<ArrowRight /> {parsed.summary.latestDate}
                  </>
                )}
              </dd>
              <dt className="text-fg-muted">Main / Academy</dt>
              <dd>
                {parsed.summary.byGroup.main} / {parsed.summary.byGroup.academy}
              </dd>
              <dt className="text-fg-muted">Attended / Cancelled-late</dt>
              <dd>
                {parsed.summary.byStatus.attended} / {parsed.summary.byStatus.cancelled_late}
              </dd>
              <dt className="text-fg-muted">Captains / POTW</dt>
              <dd>
                {parsed.summary.captains} / {parsed.summary.potws}
              </dd>
              <dt className="text-fg-muted">Parse errors</dt>
              <dd className={parsed.result.errors.length > 0 ? 'text-[var(--danger-fg)]' : ''}>
                {parsed.result.errors.length}
              </dd>
            </dl>

            {parsed.result.errors.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-fg-muted">
                  Show errors ({parsed.result.errors.length})
                </summary>
                <ul className="mt-2 space-y-1 max-h-60 overflow-auto">
                  {parsed.result.errors.slice(0, 50).map((e) => (
                    <li key={e.rowNumber} className="text-[var(--danger-fg)]">
                      Row {e.rowNumber}: {e.reason}{' '}
                      <span className="text-fg-muted">- {e.raw}</span>
                    </li>
                  ))}
                  {parsed.result.errors.length > 50 && (
                    <li className="text-fg-muted">
                      …and {parsed.result.errors.length - 50} more. Fix in source &amp; re-export.
                    </li>
                  )}
                </ul>
              </details>
            )}
          </section>

          {parsed.summary.totalRows > 0 && (
            <form action={runImport} className="space-y-3 max-w-xl">
              <h2 className="text-xl font-bold">Step 2: session defaults</h2>
              <p className="text-fg-muted text-sm">
                These values are applied to every session created by this import. They&apos;re
                editable later from <code>/admin/sessions</code>.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <label className="block col-span-2">
                  <span className="block mb-1">Main coaches</span>
                  <CoachMultiSelect name="main_coach_ids" coaches={coaches} placeholder="Select Main coaches…" />
                </label>
                <label className="block col-span-2">
                  <span className="block mb-1">Academy coaches</span>
                  <CoachMultiSelect name="academy_coach_ids" coaches={coaches} placeholder="Select Academy coaches…" />
                </label>
                <label className="block">
                  <span className="block mb-1">Main start</span>
                  <input type="time" name="main_start" required defaultValue="19:00" className="w-full" />
                </label>
                <label className="block">
                  <span className="block mb-1">Main end</span>
                  <input type="time" name="main_end" required defaultValue="20:00" className="w-full" />
                </label>
                <label className="block">
                  <span className="block mb-1">Academy start</span>
                  <input type="time" name="academy_start" required defaultValue="19:00" className="w-full" />
                </label>
                <label className="block">
                  <span className="block mb-1">Academy end</span>
                  <input type="time" name="academy_end" required defaultValue="20:00" className="w-full" />
                </label>
                <label className="block">
                  <span className="block mb-1">Main price (£)</span>
                  <input
                    type="number"
                    name="main_price"
                    min={0}
                    step="0.01"
                    required
                    defaultValue="12.00"
                    className="w-full"
                  />
                </label>
                <label className="block">
                  <span className="block mb-1">Academy price (£)</span>
                  <input
                    type="number"
                    name="academy_price"
                    min={0}
                    step="0.01"
                    required
                    defaultValue="20.00"
                    className="w-full"
                  />
                </label>
                <label className="block">
                  <span className="block mb-1">Main capacity</span>
                  <input
                    type="number"
                    name="main_capacity"
                    min={1}
                    required
                    defaultValue="16"
                    className="w-full"
                  />
                </label>
                <label className="block">
                  <span className="block mb-1">Academy capacity</span>
                  <input
                    type="number"
                    name="academy_capacity"
                    min={1}
                    required
                    defaultValue="6"
                    className="w-full"
                  />
                </label>
                <label className="block col-span-2">
                  <span className="block mb-1">Payment method</span>
                  <select name="payment_method" defaultValue="cash" className="w-full">
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="free">Free</option>
                    <option value="other">Other</option>
                  </select>
                </label>
              </div>

              <input
                type="hidden"
                name="rows_json"
                value={JSON.stringify(parsed.result.rows)}
              />

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button type="submit">Confirm import ({parsed.summary.totalRows} rows)</button>
                <button
                  type="button"
                  onClick={() => setParsed(null)}
                  className="bg-transparent border border-line text-fg hover:bg-surface-2 font-normal"
                >
                  Cancel
                </button>
                <span className="text-fg-muted text-sm">
                  Re-running this import on the same data is safe - sessions and bookings dedupe.
                </span>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
