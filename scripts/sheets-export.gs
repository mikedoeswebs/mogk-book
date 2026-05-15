/**
 * MO Goalkeeping — historic data exporter
 * =======================================
 *
 * Reads the active Google Sheet (the one that looks like a wide grid of
 * coloured checkboxes per player × date) and writes a long-form CSV to a new
 * "Export" tab.
 *
 * Source format the script expects:
 *   - Row 1, column A: any header (e.g. "Player"); ignored.
 *   - Row 1, columns B onwards: date headers in DD/MM/YY or DD/MM/YYYY format.
 *   - Column A from row 2 onwards: player full name.
 *   - Each cell at (player row, date column): a Google Sheets checkbox with
 *     conditional formatting:
 *       - Solid green checkbox fill → attended Main group
 *       - Solid purple checkbox fill → attended Academy group
 *       - Green-outline / unfilled green cell → paid Main but cancelled <24h
 *       - Purple-outline / unfilled purple cell → paid Academy but cancelled <24h
 *       - Empty / grey: skipped (no event)
 *   - Cell background fill (i.e. the cell behind the checkbox):
 *       - Blue → that player was Captain that week
 *       - Gold → that player won Player of the Week that week
 *
 * Tweak COLOUR_RULES below to match the actual hexes your sheet uses — they
 * vary depending on the conditional-formatting palette you chose.
 *
 * Usage:
 *   1. Open the Sheet → Extensions → Apps Script.
 *   2. Paste this whole file. Save.
 *   3. (Optional) If your data is split across tabs (e.g. one per year), the
 *      default behaviour reads every tab except "Export" and merges them into
 *      a single output CSV. To pick a subset, list them in SOURCE_SHEET_NAMES
 *      below: ['Essex 2023', 'Essex 2024'].
 *   4. Optionally adjust COLOUR_RULES with hex codes that match your sheet.
 *   5. Run `exportHistoric` once from the editor — first run will ask for
 *      permission to read/write the sheet.
 *   6. A tab called "Export" is created (or overwritten) containing the
 *      combined CSV-ready rows from every source tab. Use File → Download →
 *      CSV on that tab to grab the file.
 */

/**
 * If you're running this from a STANDALONE Apps Script project (one not bound
 * to a Sheet), paste the source spreadsheet's ID here. You can find it in the
 * sheet's URL between /d/ and /edit:
 *   https://docs.google.com/spreadsheets/d/THIS_LONG_BIT/edit#gid=0
 *
 * Leave blank if this script is bound to the source sheet (Extensions → Apps
 * Script from inside that sheet).
 */
const SPREADSHEET_ID = '';

/**
 * Which tabs to read. Each tab is processed and the rows are appended into
 * a single "Export" tab, so you can split your data by year (or anything
 * else) and combine in one run.
 *
 *   []                       → every tab in the workbook EXCEPT "Export"
 *   ['Essex 2023', '...']    → only the listed tabs, in this order
 *
 * If a listed tab doesn't exist it's silently skipped; if a sheet is empty
 * it's logged and skipped. The output tab is always named "Export".
 */
const SOURCE_SHEET_NAMES = ['Essex 2023', 'Essex 2024', 'Essex 2025', 'Essex 2026'];

const COLOUR_RULES = {
  // Tweak to match your actual conditional-formatting hexes.
  // Use lower-case 6-digit hex without alpha.
  greenFills: ['#34a853', '#0f9d58', '#5a9e71'],     // attended Main
  purpleFills: ['#9c27b0', '#8e44ad', '#a142f4', '#920df9'],    // attended Academy
  greenOutlines: ['#b7e1cd', '#ceead6'],             // paid Main, cancelled <24h (lighter green fills)
  purpleOutlines: ['#d6b2dd', '#e3c8ec', '#920df9'],            // paid Academy, cancelled <24h (lighter purple)
  captainBgs: ['#cfe2f3', '#b4d0f7', '#9fc5f8'],     // blue cell background
  potwBgs: ['#fff2cc', '#fce5a4', '#ffe599'],        // gold cell background
};

function exportHistoric() {
  const ss = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error(
      'No spreadsheet to read. Either set SPREADSHEET_ID at the top of this script, or open the sheet in your browser and run this script from Extensions → Apps Script in that tab.'
    );
  }

  const sheets = resolveSourceSheets_(ss);
  if (sheets.length === 0) {
    throw new Error(
      'Couldn\'t find any source sheets. Set SOURCE_SHEET_NAMES at the top of the script to the tab names with your data.'
    );
  }

  // Use the SPREADSHEET'S timezone (not UTC) when converting Date objects to
  // ISO strings — otherwise BST/UTC offsets silently roll the date back a day.
  const sheetTz = ss.getSpreadsheetTimeZone();

  const playerOut = [['date', 'player_name', 'group', 'status', 'captain', 'potw']];
  const coachOut  = [['date', 'coach_name']];
  const playerPerSheet = [];
  const coachPerSheet = [];

  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    const name = sheet.getName();
    const isCoach = /^coaches\b/i.test(name);
    if (isCoach) {
      const before = coachOut.length;
      appendCoachSheetRows_(sheet, sheetTz, coachOut);
      coachPerSheet.push(name + ': ' + (coachOut.length - before));
    } else {
      const before = playerOut.length;
      appendSheetRows_(sheet, sheetTz, playerOut);
      playerPerSheet.push(name + ': ' + (playerOut.length - before));
    }
  }

  writeExportTab_(ss, 'Export', playerOut);
  if (coachOut.length > 1) {
    writeExportTab_(ss, 'Export Coaches', coachOut);
  }

  const messageParts = [
    'Exported ' + (playerOut.length - 1) + ' player rows to the "Export" tab.',
  ];
  if (playerPerSheet.length > 0) messageParts.push(playerPerSheet.join('\n'));
  if (coachOut.length > 1) {
    messageParts.push('');
    messageParts.push('Exported ' + (coachOut.length - 1) + ' coach rows to the "Export Coaches" tab.');
    messageParts.push(coachPerSheet.join('\n'));
  }
  messageParts.push('');
  messageParts.push('Now File → Download → CSV on each tab to grab the files.');

  const message = messageParts.join('\n');
  // `getUi()` only works when this script is container-bound to the Sheet.
  // Running as a standalone project (via SPREADSHEET_ID) throws — fall back
  // to a logger message so the result is still visible.
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (e) {
    Logger.log(message);
  }
}

function writeExportTab_(ss, tabName, rows) {
  let exportSheet = ss.getSheetByName(tabName);
  if (exportSheet) {
    exportSheet.clear();
  } else {
    exportSheet = ss.insertSheet(tabName);
  }
  exportSheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  exportSheet.setFrozenRows(1);
}

/**
 * Pull rows out of a "Coaches YYYY" sheet. Layout:
 *   - Row 1, col A: "Coach" (or anything); ignored.
 *   - Row 1, col B onwards: date headers.
 *   - Col A row 2+: coach names.
 *   - Cells: checkbox TRUE/FALSE. TRUE → coach was at every session that day.
 *
 * Emits (date, coach_name) pairs into the shared `out` accumulator.
 */
function appendCoachSheetRows_(sheet, tz, out) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 2) {
    Logger.log('Skipping coaches "' + sheet.getName() + '" — no data rows.');
    return;
  }

  const dateHeaderRange = sheet.getRange(1, 2, 1, lastCol - 1);
  const dateHeaderValues = dateHeaderRange.getValues()[0];
  const dateHeaderDisplay = dateHeaderRange.getDisplayValues()[0];
  const isoDates = dateHeaderValues.map((cellValue, i) => {
    const raw = dateHeaderDisplay[i] || String(cellValue || '');
    return parseDate_(raw, cellValue, tz);
  });

  const coachRange = sheet.getRange(2, 1, lastRow - 1, 1);
  const coachNames = coachRange.getValues().map((row) => String(row[0] || '').trim());

  const cellRange = sheet.getRange(2, 2, lastRow - 1, lastCol - 1);
  const cellValues = cellRange.getValues();

  for (let r = 0; r < coachNames.length; r++) {
    const coach = coachNames[r];
    if (!coach) continue;
    for (let c = 0; c < isoDates.length; c++) {
      const iso = isoDates[c];
      if (!iso) continue;
      if (cellValues[r][c] === true) {
        out.push([iso, coach]);
      }
    }
  }
}

/**
 * Append decoded rows from one source sheet into the shared `out` accumulator.
 * Silently skips empty / malformed sheets so they don't block a multi-tab run.
 */
function appendSheetRows_(sheet, tz, out) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 2) {
    Logger.log('Skipping "' + sheet.getName() + '" — no data rows.');
    return;
  }

  const dateHeaderRange = sheet.getRange(1, 2, 1, lastCol - 1);
  const dateHeaderValues = dateHeaderRange.getValues()[0];
  const dateHeaderDisplay = dateHeaderRange.getDisplayValues()[0];

  const isoDates = dateHeaderValues.map((cellValue, i) => {
    const raw = dateHeaderDisplay[i] || String(cellValue || '');
    return parseDate_(raw, cellValue, tz);
  });

  const playerRange = sheet.getRange(2, 1, lastRow - 1, 1);
  const playerNames = playerRange.getValues().map((row) => String(row[0] || '').trim());

  const cellRange = sheet.getRange(2, 2, lastRow - 1, lastCol - 1);
  const cellValues = cellRange.getValues();
  const cellBackgrounds = cellRange.getBackgrounds();
  const cellFontColors = cellRange.getFontColors();

  for (let r = 0; r < playerNames.length; r++) {
    const player = playerNames[r];
    if (!player) continue;
    for (let c = 0; c < isoDates.length; c++) {
      const iso = isoDates[c];
      if (!iso) continue;

      const value = cellValues[r][c];
      const bg = (cellBackgrounds[r][c] || '').toLowerCase();
      const fontColour = (cellFontColors[r][c] || '').toLowerCase();

      const decoded = decodeCell_(value, bg, fontColour);
      if (!decoded) continue;

      const isCaptain = inPalette_(bg, COLOUR_RULES.captainBgs);
      const isPotw = inPalette_(bg, COLOUR_RULES.potwBgs);

      out.push([
        iso,
        player,
        decoded.group,
        decoded.status,
        isCaptain ? 'true' : 'false',
        isPotw ? 'true' : 'false',
      ]);
    }
  }
}

/**
 * Decide which group + status a cell encodes. Returns null if the cell is
 * empty / grey / not part of the encoded set.
 *
 * Rather than matching exact hex values, we classify colours by their RGB
 * profile so slight shade variations between rules don't trip us up. A green
 * or purple signal can come from EITHER the cell background or the font
 * colour — whichever your conditional formatting uses.
 */
function decodeCell_(value, bg, fontColour) {
  const checked = value === true;
  const bgClass = classifyColour_(bg);
  const fgClass = classifyColour_(fontColour);

  // Prefer the font signal (matches Sheets' default checkbox rendering),
  // otherwise fall back to the cell background.
  const groupSignal =
    fgClass === 'green' ? 'main' :
    fgClass === 'purple' ? 'academy' :
    bgClass === 'green' ? 'main' :
    bgClass === 'purple' ? 'academy' :
    null;

  if (!groupSignal) return null;

  return {
    group: groupSignal,
    status: checked ? 'attended' : 'cancelled_late',
  };
}

/**
 * Classify a hex colour as 'green', 'purple', 'blue', 'gold', or null
 * (white / black / grey / anything we don't care about). Robust to small
 * palette differences between conditional-formatting rules.
 */
function classifyColour_(hex) {
  if (!hex) return null;
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return null;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  // Near-white / near-black / grey → no signal.
  if (max - min < 24) return null;

  // Green: green dominates clearly.
  if (g > r && g > b && g - Math.max(r, b) > 20) return 'green';

  // Purple: red AND blue both well above green.
  if (r > g && b > g && Math.min(r, b) - g > 18) return 'purple';

  // Blue: blue dominates clearly.
  if (b > r && b > g && b - Math.max(r, g) > 20) return 'blue';

  // Gold / cream / amber: warm tone (R and G high, B noticeably lower).
  if (r > 200 && g > 170 && b < 200 && r >= g && (r + g) / 2 - b > 25) return 'gold';

  return null;
}

/**
 * Inspect a single cell from the Apps Script editor. Pass A1 notation, e.g.
 *   debugCell('F8')
 * The result is logged to View → Logs. Useful when the export skips data you
 * expected it to pick up: run this on a known-good "Academy attended" cell
 * and see what colours it actually reports.
 */
function debugCell(a1Notation) {
  const ss = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    Logger.log('No spreadsheet available. Set SPREADSHEET_ID or open the sheet first.');
    return;
  }
  const sheets = resolveSourceSheets_(ss);
  // debugCell inspects the first matching source sheet — that's enough for
  // troubleshooting colour rules.
  const sheet = sheets[0];
  if (!sheet) {
    Logger.log('No source sheet. Set SOURCE_SHEET_NAMES at the top of the script.');
    return;
  }
  const range = sheet.getRange(a1Notation);
  const bg = range.getBackground();
  const fg = range.getFontColor();
  Logger.log(JSON.stringify({
    a1: a1Notation,
    sheet: sheet.getName(),
    value: range.getValue(),
    background: bg,
    background_class: classifyColour_(bg),
    fontColor: fg,
    fontColor_class: classifyColour_(fg),
    fontWeight: range.getFontWeight(),
    note: range.getNote(),
  }, null, 2));
}

/**
 * Resolve the source sheets to process.
 *
 *   - If SOURCE_SHEET_NAMES has entries, return those tabs (in order, skipping
 *     ones that don't exist) PLUS any tab whose name starts with "Coaches ".
 *     Coach tabs are auto-included so the assignments export still runs even
 *     when the admin only lists player tabs in SOURCE_SHEET_NAMES.
 *   - Otherwise return every tab in the workbook except the output tabs.
 */
function resolveSourceSheets_(ss) {
  const excluded = ['Export', 'Export Coaches'];
  const isExcluded = (name) => excluded.indexOf(name) !== -1;
  const isCoachSheet = (name) => /^coaches\b/i.test(name);

  if (Array.isArray(SOURCE_SHEET_NAMES) && SOURCE_SHEET_NAMES.length > 0) {
    const out = [];
    const picked = {};
    for (let i = 0; i < SOURCE_SHEET_NAMES.length; i++) {
      const name = SOURCE_SHEET_NAMES[i];
      if (!name || isExcluded(name)) continue;
      const sheet = ss.getSheetByName(name);
      if (sheet) {
        out.push(sheet);
        picked[sheet.getName()] = true;
      } else {
        Logger.log('Source tab "' + name + '" not found — skipping.');
      }
    }
    // Always include any "Coaches *" tab so coach assignments aren't lost
    // when the explicit list only names player tabs.
    const all = ss.getSheets();
    for (let j = 0; j < all.length; j++) {
      const s = all[j];
      const n = s.getName();
      if (picked[n] || isExcluded(n)) continue;
      if (isCoachSheet(n)) out.push(s);
    }
    return out;
  }
  return ss.getSheets().filter((s) => !isExcluded(s.getName()));
}

function inPalette_(hex, palette) {
  if (!hex) return false;
  const h = hex.toLowerCase();
  for (let i = 0; i < palette.length; i++) {
    if (h === palette[i].toLowerCase()) return true;
  }
  return false;
}

/**
 * Parses date headers. Accepts:
 *   - Real Date values (returned by Sheets when the cell is formatted as Date).
 *   - DD/MM/YY or DD/MM/YYYY strings.
 *
 * Date branch: we read the calendar parts via local methods
 * (getFullYear / getMonth / getDate). Apps Script returns Date values
 * representing midnight in the *script project's* timezone (which may differ
 * from the spreadsheet's timezone), so anything that asks "what's this in
 * UTC?" or "what's this in the spreadsheet's tz?" can silently shift a day.
 * The local getters always return the calendar date the Date was constructed
 * with, regardless of which timezone that was.
 *
 * The `tz` argument is kept for backwards compatibility but no longer used.
 */
function parseDate_(displayString, cellValue, tz) {
  void tz;
  if (cellValue instanceof Date && !isNaN(cellValue.getTime())) {
    return cellValue.getFullYear() + '-' +
      pad_(cellValue.getMonth() + 1) + '-' +
      pad_(cellValue.getDate());
  }
  const m = String(displayString || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  let year = parseInt(m[3], 10);
  if (year < 100) year += 2000;  // 23 → 2023
  return year + '-' + pad_(month) + '-' + pad_(day);
}

function pad_(n) {
  return n < 10 ? '0' + n : '' + n;
}
