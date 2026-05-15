/**
 * Parser + validator for the coach-assignments CSV produced by
 * `scripts/sheets-export.gs` from "Coaches YYYY" tabs.
 *
 * Expected columns (header row required, exact names):
 *   date,coach_name
 *
 * - date: YYYY-MM-DD
 * - coach_name: non-empty string
 *
 * One row per (date, coach who attended). Multiple rows per date are normal —
 * each one is one coach for that day.
 */

export type CoachAssignmentRow = {
  date: string;          // YYYY-MM-DD
  coach_name: string;
};

export type CoachAssignmentParseError = {
  rowNumber: number;
  raw: string;
  reason: string;
};

export type CoachAssignmentParseResult = {
  rows: CoachAssignmentRow[];
  errors: CoachAssignmentParseError[];
};

const REQUIRED_HEADERS = ['date', 'coach_name'];

export function parseCoachAssignmentsCsv(text: string): CoachAssignmentParseResult {
  const lines = splitLines(text);
  if (lines.length === 0) {
    return { rows: [], errors: [{ rowNumber: 0, raw: '', reason: 'CSV is empty' }] };
  }

  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const missing = REQUIRED_HEADERS.filter((h) => !header.includes(h));
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [{
        rowNumber: 1,
        raw: lines[0],
        reason: `Missing required columns: ${missing.join(', ')}`,
      }],
    };
  }

  const idx = Object.fromEntries(
    REQUIRED_HEADERS.map((h) => [h, header.indexOf(h)]),
  ) as Record<string, number>;

  const rows: CoachAssignmentRow[] = [];
  const errors: CoachAssignmentParseError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.trim() === '') continue;
    const fields = parseCsvLine(raw);
    const date = (fields[idx.date] ?? '').trim();
    const coachName = (fields[idx.coach_name] ?? '').trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push({ rowNumber: i + 1, raw, reason: `Invalid date "${date}"` });
      continue;
    }
    if (Number.isNaN(Date.parse(date + 'T00:00:00Z'))) {
      errors.push({ rowNumber: i + 1, raw, reason: `Unparseable date "${date}"` });
      continue;
    }
    if (!coachName) {
      errors.push({ rowNumber: i + 1, raw, reason: 'Empty coach_name' });
      continue;
    }

    rows.push({ date, coach_name: coachName });
  }

  return { rows, errors };
}

export type CoachAssignmentSummary = {
  totalRows: number;
  distinctCoaches: number;
  distinctDates: number;
  earliestDate: string | null;
  latestDate: string | null;
};

export function summariseCoachAssignments(rows: CoachAssignmentRow[]): CoachAssignmentSummary {
  const coaches = new Set<string>();
  const dates = new Set<string>();
  let earliest: string | null = null;
  let latest: string | null = null;
  for (const r of rows) {
    coaches.add(r.coach_name.toLowerCase());
    dates.add(r.date);
    if (earliest === null || r.date < earliest) earliest = r.date;
    if (latest === null || r.date > latest) latest = r.date;
  }
  return {
    totalRows: rows.length,
    distinctCoaches: coaches.size,
    distinctDates: dates.size,
    earliestDate: earliest,
    latestDate: latest,
  };
}

// ---------------------------------------------------------------------------
// Local copies of the CSV utilities from lib/import/historic.ts. Kept here so
// this module is self-contained and easy to reuse later.
// ---------------------------------------------------------------------------

function splitLines(text: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { inQuotes = !inQuotes; current += ch; }
    else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      if (current.length > 0 || out.length === 0) out.push(current);
      current = '';
    } else current += ch;
  }
  if (current.length > 0) out.push(current);
  return out;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = false;
      } else current += ch;
    } else {
      if (ch === ',') { fields.push(current); current = ''; }
      else if (ch === '"' && current === '') inQuotes = true;
      else current += ch;
    }
  }
  fields.push(current);
  return fields;
}
