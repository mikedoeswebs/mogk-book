/**
 * Pure parser + validator for the historic-attendance CSV produced by
 * `scripts/sheets-export.gs`.
 *
 * Expected columns (header row required, exact names):
 *   date,player_name,group,status,captain,potw
 *
 * - date: YYYY-MM-DD
 * - player_name: non-empty string
 * - group: "main" | "academy"
 * - status: "attended" | "cancelled_late"
 * - captain, potw: "true" | "false" (case-insensitive)
 *
 * Rows that fail validation are surfaced in the `errors` list with a
 * one-based row number (matching the CSV file's line) so the admin can fix
 * them in the source sheet and re-export.
 */

export type HistoricRow = {
  date: string;            // YYYY-MM-DD
  player_name: string;
  group: 'main' | 'academy';
  status: 'attended' | 'cancelled_late';
  captain: boolean;
  potw: boolean;
  coach?: string;          // optional - per-week coach override
};

export type HistoricParseError = {
  rowNumber: number;       // 1-based, matches the CSV line including header
  raw: string;             // the original line
  reason: string;
};

export type HistoricParseResult = {
  rows: HistoricRow[];
  errors: HistoricParseError[];
};

const REQUIRED_HEADERS = ['date', 'player_name', 'group', 'status', 'captain', 'potw'];
const OPTIONAL_HEADERS = ['coach'];

export function parseCsvText(text: string): HistoricParseResult {
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
    [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS].map((h) => [h, header.indexOf(h)]),
  ) as Record<string, number>;

  const rows: HistoricRow[] = [];
  const errors: HistoricParseError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.trim() === '') continue;
    const fields = parseCsvLine(raw);
    const validated = validateRow(fields, idx);
    if ('error' in validated) {
      errors.push({ rowNumber: i + 1, raw, reason: validated.error });
    } else {
      rows.push(validated);
    }
  }

  return { rows, errors };
}

type ValidIdx = Record<string, number>;

function validateRow(fields: string[], idx: ValidIdx): HistoricRow | { error: string } {
  const date = (fields[idx.date] ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: `Invalid date "${date}" (expected YYYY-MM-DD)` };
  if (Number.isNaN(Date.parse(date + 'T00:00:00Z'))) return { error: `Unparseable date "${date}"` };

  const playerName = (fields[idx.player_name] ?? '').trim();
  if (!playerName) return { error: 'Empty player_name' };

  const groupRaw = (fields[idx.group] ?? '').trim().toLowerCase();
  if (groupRaw !== 'main' && groupRaw !== 'academy') {
    return { error: `Invalid group "${groupRaw}" (expected "main" or "academy")` };
  }

  const statusRaw = (fields[idx.status] ?? '').trim().toLowerCase();
  if (statusRaw !== 'attended' && statusRaw !== 'cancelled_late') {
    return { error: `Invalid status "${statusRaw}" (expected "attended" or "cancelled_late")` };
  }

  const captain = parseBool(fields[idx.captain]);
  const potw = parseBool(fields[idx.potw]);
  if (captain === null) return { error: 'Invalid captain (expected true/false)' };
  if (potw === null) return { error: 'Invalid potw (expected true/false)' };

  const coachIdx = idx.coach;
  const coach =
    coachIdx >= 0 ? (fields[coachIdx] ?? '').trim() || undefined : undefined;

  return {
    date,
    player_name: playerName,
    group: groupRaw,
    status: statusRaw,
    captain,
    potw,
    coach,
  };
}

function parseBool(raw: string | undefined): boolean | null {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no' || v === '') return false;
  return null;
}

/**
 * Splits a CSV body into logical lines, respecting quoted fields that may
 * contain embedded newlines. Simple but correct enough for our generated CSV.
 */
function splitLines(text: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      if (current.length > 0 || out.length === 0) out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.length > 0) out.push(current);
  return out;
}

/**
 * RFC4180-ish single-line CSV parser. Handles double-quoted fields and
 * embedded "" escapes.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === ',') {
        fields.push(current);
        current = '';
      } else if (ch === '"' && current === '') {
        inQuotes = true;
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

// ---------------------------------------------------------------------------
// Summary helpers
// ---------------------------------------------------------------------------

export type HistoricSummary = {
  totalRows: number;
  distinctPlayers: number;
  distinctDates: number;
  byGroup: { main: number; academy: number };
  byStatus: { attended: number; cancelled_late: number };
  captains: number;
  potws: number;
  earliestDate: string | null;
  latestDate: string | null;
};

export function summarise(rows: HistoricRow[]): HistoricSummary {
  const players = new Set<string>();
  const dates = new Set<string>();
  let main = 0, academy = 0, attended = 0, cancelledLate = 0, captains = 0, potws = 0;
  let earliest: string | null = null;
  let latest: string | null = null;

  for (const r of rows) {
    players.add(r.player_name.toLowerCase());
    dates.add(r.date);
    if (r.group === 'main') main++; else academy++;
    if (r.status === 'attended') attended++; else cancelledLate++;
    if (r.captain) captains++;
    if (r.potw) potws++;
    if (earliest === null || r.date < earliest) earliest = r.date;
    if (latest === null || r.date > latest) latest = r.date;
  }

  return {
    totalRows: rows.length,
    distinctPlayers: players.size,
    distinctDates: dates.size,
    byGroup: { main, academy },
    byStatus: { attended, cancelled_late: cancelledLate },
    captains,
    potws,
    earliestDate: earliest,
    latestDate: latest,
  };
}
