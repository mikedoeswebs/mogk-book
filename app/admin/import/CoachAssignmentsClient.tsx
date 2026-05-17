'use client';

import { useState } from 'react';
import {
  parseCoachAssignmentsCsv,
  summariseCoachAssignments,
  type CoachAssignmentParseResult,
  type CoachAssignmentSummary,
} from '@/lib/import/coachAssignments';
import { ArrowRight } from '@/lib/ui/Icon';
import { SubmitButton } from '@/lib/ui/SubmitButton';
import { runCoachAssignmentsImport } from './coach-actions';

type Parsed = {
  result: CoachAssignmentParseResult;
  summary: CoachAssignmentSummary;
  fileName: string;
};

export function CoachAssignmentsClient() {
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [parsing, setParsing] = useState(false);

  async function handleFile(file: File | null) {
    if (!file) {
      setParsed(null);
      return;
    }
    setParsing(true);
    const text = await file.text();
    const result = parseCoachAssignmentsCsv(text);
    const summary = summariseCoachAssignments(result.rows);
    setParsed({ result, summary, fileName: file.name });
    setParsing(false);
  }

  return (
    <div className="space-y-4">
      <label className="block max-w-xl border border-line rounded p-4 cursor-pointer hover:bg-surface-2">
        <span className="block mb-4 font-heading font-bold uppercase text-sm tracking-wide">
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

      {parsed && (
        <>
          <section className="space-y-2 p-4 border border-line rounded bg-surface">
            <h3 className="text-lg font-bold">Preview | {parsed.fileName}</h3>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-sm">
              <dt className="text-fg-muted">Valid rows</dt>
              <dd>{parsed.summary.totalRows}</dd>
              <dt className="text-fg-muted">Distinct coaches</dt>
              <dd>{parsed.summary.distinctCoaches}</dd>
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
                </ul>
              </details>
            )}
          </section>

          {parsed.summary.totalRows > 0 && (
            <form action={runCoachAssignmentsImport} className="space-y-3 max-w-xl">
              <input
                type="hidden"
                name="rows_json"
                value={JSON.stringify(parsed.result.rows)}
              />
              <div className="flex flex-wrap items-center gap-3">
                <SubmitButton pendingLabel="Applying…">
                  Apply coach assignments ({parsed.summary.distinctDates} date{parsed.summary.distinctDates === 1 ? '' : 's'})
                </SubmitButton>
                <button
                  type="button"
                  onClick={() => setParsed(null)}
                  className="bg-transparent border border-line text-fg hover:bg-surface-2 font-normal"
                >
                  Cancel
                </button>
                <span className="text-fg-muted text-sm">
                  For each date in the file, the listed coaches replace any existing coach roster
                  on every session for that date.
                </span>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
