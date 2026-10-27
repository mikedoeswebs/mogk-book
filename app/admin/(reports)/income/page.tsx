import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatPence } from '@/lib/format';
import { ArrowLeft, ArrowRight } from '@/lib/ui/Icon';
import {
  getIncomeSummary,
  getIncomeMonthly,
  getCreditOutstanding,
  type IncomeMonthlyRow,
} from '@/lib/admin/analytics';

// The club started in 2023 — no income before then.
const MIN_TAX_YEAR = 2023;

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Start year of the UK tax year (6 Apr – 5 Apr) that a given date falls in. */
function taxYearStartFor(d: Date): number {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth(); // 0 = Jan, 3 = Apr
  const day = d.getUTCDate();
  return m > 3 || (m === 3 && day >= 6) ? y : y - 1;
}

/** "2026/27" for the tax year starting in 2026. */
function taxYearLabel(startYear: number): string {
  return `${startYear}/${String(startYear + 1).slice(2)}`;
}

/** First-of-month dates spanning a tax year, Apr (startYear) → Apr (startYear+1). */
function monthStartsForTaxYear(startYear: number): string[] {
  const out: string[] = [];
  // April → December of the start year.
  for (let m = 4; m <= 12; m++) {
    out.push(`${startYear}-${String(m).padStart(2, '0')}-01`);
  }
  // January → April of the following year (April is the 6 Apr–5 Apr sliver).
  for (let m = 1; m <= 4; m++) {
    out.push(`${startYear + 1}-${String(m).padStart(2, '0')}-01`);
  }
  return out;
}

function labelForMonthStart(monthStart: string): string {
  const year = monthStart.slice(0, 4);
  const monthIndex = Number(monthStart.slice(5, 7)) - 1;
  return `${MONTH_NAMES[monthIndex]} ${year}`;
}

export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<{ ty?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const currentTaxYear = taxYearStartFor(new Date());
  // Allow one tax year ahead for sessions already scheduled.
  const maxTaxYear = currentTaxYear + 1;
  const startYear = parseTaxYear(sp.ty, maxTaxYear) ?? currentTaxYear;
  const prevYear = startYear - 1;
  const hasPrev = startYear > MIN_TAX_YEAR;
  const hasNext = startYear < maxTaxYear;

  // The UK tax year runs 6 April → 5 April.
  const rangeStart = `${startYear}-04-06`;
  const rangeEnd = `${startYear + 1}-04-05`;
  const prevRangeStart = `${prevYear}-04-06`;
  const prevRangeEnd = `${startYear}-04-05`;

  const supabase = createSupabaseAdminClient();
  const [thisYear, lastYear, monthly, creditOutstanding] = await Promise.all([
    getIncomeSummary(supabase, rangeStart, rangeEnd),
    getIncomeSummary(supabase, prevRangeStart, prevRangeEnd),
    getIncomeMonthly(supabase, rangeStart, rangeEnd),
    getCreditOutstanding(supabase),
  ]);

  // Index monthly rows by their month_start (YYYY-MM-01) for lookup.
  const byMonth = new Map<string, IncomeMonthlyRow>();
  for (const row of monthly) {
    byMonth.set(row.month_start.slice(0, 10), row);
  }
  const months = monthStartsForTaxYear(startYear);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Income</h1>
        <nav className="flex gap-2">
          {hasPrev ? (
            <Link
              href={`/admin/income?ty=${prevYear}`}
              className="px-3 py-1 border border-line rounded no-underline text-fg-muted hover:bg-surface"
            >
              <ArrowLeft /> {taxYearLabel(prevYear)}
            </Link>
          ) : (
            <span className="px-3 py-1 border border-line rounded text-fg-muted opacity-50" aria-disabled="true">
              <ArrowLeft /> {taxYearLabel(prevYear)}
            </span>
          )}
          <span className="px-3 py-1 border border-line rounded bg-surface font-semibold">
            {taxYearLabel(startYear)}
          </span>
          {hasNext ? (
            <Link
              href={`/admin/income?ty=${startYear + 1}`}
              className="px-3 py-1 border border-line rounded no-underline text-fg-muted hover:bg-surface"
            >
              {taxYearLabel(startYear + 1)} <ArrowRight />
            </Link>
          ) : (
            <span className="px-3 py-1 border border-line rounded text-fg-muted opacity-50" aria-disabled="true">
              {taxYearLabel(startYear + 1)} <ArrowRight />
            </span>
          )}
        </nav>
      </div>

      <p className="text-sm text-fg-muted">
        Tax year {taxYearLabel(startYear)} (6 April {startYear} – 5 April {startYear + 1}). Income is recognised on
        the date each session runs. Figures exclude the booking fee, which is the Stripe charge passed on to parents,
        not income.
      </p>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MoneyKpi
          label="Total income"
          pence={thisYear.total_income_pence}
          prevPence={lastYear.total_income_pence}
        />
        <MoneyKpi
          label="Sessions delivered"
          pence={thisYear.delivered_pence}
          prevPence={lastYear.delivered_pence}
          hint={`${thisYear.delivered_bookings} booking${thisYear.delivered_bookings === 1 ? '' : 's'}`}
        />
        <MoneyKpi
          label="Late forfeits"
          pence={thisYear.forfeited_pence}
          prevPence={lastYear.forfeited_pence}
          hint={`${thisYear.forfeited_bookings} cancellation${thisYear.forfeited_bookings === 1 ? '' : 's'}`}
          muted
        />
        <MoneyKpi
          label="Credit outstanding"
          pence={creditOutstanding}
          hint="Owed to parents now"
          muted
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">Monthly breakdown</h2>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th className="text-right!">Delivered</th>
                <th className="text-right!">Late forfeits</th>
                <th className="text-right!">Total</th>
              </tr>
            </thead>
            <tbody>
              {months.map((monthStart) => {
                const row = byMonth.get(monthStart);
                return (
                  <tr key={monthStart}>
                    <td>{labelForMonthStart(monthStart)}</td>
                    <td className="text-right">{formatPence(row?.delivered_pence ?? 0)}</td>
                    <td className="text-right">{formatPence(row?.forfeited_pence ?? 0)}</td>
                    <td className="text-right font-semibold">{formatPence(row?.total_income_pence ?? 0)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-bold border-t-2 border-line">
                <td>Tax year {taxYearLabel(startYear)}</td>
                <td className="text-right">{formatPence(thisYear.delivered_pence)}</td>
                <td className="text-right">{formatPence(thisYear.forfeited_pence)}</td>
                <td className="text-right">{formatPence(thisYear.total_income_pence)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-xs text-fg-muted">
          The tax year runs 6 April – 5 April, so April appears twice, a year apart: the first row counts 6–30 April,
          the last counts 1–5 April. Booking fees collected this tax year (paid through to Stripe, not income):{' '}
          {formatPence(thisYear.booking_fees_pence)}.
        </p>
      </section>

      <p className="text-xs text-fg-muted">
        Income counts active bookings (coaching delivered) plus money kept from cancellations made under 24 hours
        before a session. Cancellations refunded as account credit are not counted — the income reverses when the
        booking is cancelled, and credit spent on a later booking is counted once, against that booking.
      </p>
    </div>
  );
}

function MoneyKpi({
  label,
  pence,
  prevPence,
  hint,
  muted = false,
}: {
  label: string;
  pence: number;
  prevPence?: number;
  hint?: string;
  muted?: boolean;
}) {
  const delta = prevPence === undefined ? null : pence - prevPence;
  const pct = prevPence && prevPence > 0 && delta !== null ? (delta / prevPence) * 100 : null;
  const deltaCls =
    delta === null || delta === 0
      ? 'text-fg-muted'
      : delta > 0
        ? 'text-[var(--ok-fg)]'
        : 'text-[var(--danger-fg)]';

  return (
    <div className={`p-3 border border-line rounded ${muted ? 'bg-surface-2' : 'bg-surface'}`}>
      <div className="text-xs uppercase tracking-wide text-fg-muted">{label}</div>
      <div className="text-2xl font-bold mt-1">{formatPence(pence)}</div>
      {hint && delta === null ? (
        <div className="text-xs mt-1 text-fg-muted">{hint}</div>
      ) : (
        <div className={`text-xs mt-1 ${deltaCls}`}>
          {delta === null || delta === 0
            ? 'No change vs last year'
            : `${delta > 0 ? '+' : '−'}${formatPence(Math.abs(delta))}${pct !== null ? ` (${delta > 0 ? '+' : '−'}${Math.abs(pct).toFixed(0)}%)` : ''} vs last year`}
          {hint ? ` · ${hint}` : ''}
        </div>
      )}
    </div>
  );
}

function parseTaxYear(s: string | undefined, maxYear: number): number | null {
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (n < MIN_TAX_YEAR || n > maxYear) return null;
  return Math.floor(n);
}

// Force fresh data per request (no static rendering).
export const dynamic = 'force-dynamic';
