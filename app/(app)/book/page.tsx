import Link from 'next/link';
import { requireParent } from '@/lib/auth/require-parent';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCreditBalance } from '@/lib/booking/credits';
import { calculateBookingFeePence, allocateFeePence } from '@/lib/booking/fees';
import { playerTooOld, sessionIsPast } from '@/lib/booking/rules';
import { hasFreeTrial, trialIndex } from '@/lib/booking/trial';
import { getSelection, type SelectionItem } from '@/lib/booking/selection';
import { formatDate, formatDateWeekday, formatTime, formatPence } from '@/lib/format';
import { AgeWarning, PlayerSelect, type AgeCheckRow } from '@/lib/ui/AgeCheck';
import type { Child, Session } from '@/lib/db/types';
import { SubmitButton } from '@/lib/ui/SubmitButton';
import { confirmBookings } from './actions';
import { ValidatedSubmit } from './ValidatedSubmit';

type RowState = {
  item: SelectionItem;
  session: Session | null;
  remaining: number;
  staleReason: string | null;
  cardPortion: number;
  feeShare: number;
  creditShare: number;
  trial: boolean;
};

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; stale?: string }>;
}) {
  const parent = await requireParent();
  const sp = await searchParams;
  const selection = await getSelection();

  if (selection.items.length === 0) {
    return (
      <div className="space-y-3 max-w-2xl">
        <h1 className="text-2xl font-bold">Review your sessions</h1>
        <p className="text-fg-muted">
          You haven&apos;t selected any sessions yet. Browse the{' '}
          <Link href="/sessions?view=calendar">calendar</Link> or{' '}
          <Link href="/sessions?view=list">list</Link> and add the sessions you want to book.
        </p>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const sessionIds = Array.from(new Set(selection.items.map((i) => i.sessionId)));
  const [{ data: sessions }, { data: children }, balance, freeTrial] = await Promise.all([
    supabase.from('sessions').select('*').in('id', sessionIds).returns<Session[]>(),
    supabase
      .from('children')
      .select('*')
      .eq('parent_id', parent.id)
      .order('name', { ascending: true })
      .returns<Child[]>(),
    getCreditBalance(admin, parent.id),
    hasFreeTrial(admin, parent),
  ]);

  const sessionById = new Map((sessions ?? []).map((s) => [s.id, s]));

  const { data: availability } = await supabase.rpc('get_session_availability', {
    p_session_ids: sessionIds,
  });
  const remainingById = new Map<string, number>();
  for (const a of (availability ?? []) as { session_id: string; remaining: number }[]) {
    remainingById.set(a.session_id, a.remaining);
  }

  // Track "remaining at confirm time" per session in selection order: if a
  // session has two siblings booked from a 2-spot capacity, the second
  // selection row IS that session's last seat - but a *third* selection row
  // for that session would fill above capacity.
  const remainingForSelection = new Map<string, number>();
  for (const sid of sessionIds) {
    remainingForSelection.set(sid, remainingById.get(sid) ?? sessionById.get(sid)?.capacity ?? 0);
  }

  const baseRows: RowState[] = selection.items.map((item) => {
    const session = sessionById.get(item.sessionId) ?? null;
    const remainingSoFar = remainingForSelection.get(item.sessionId) ?? 0;
    let staleReason: string | null = null;
    if (!session) staleReason = 'Session not found';
    else if (session.status !== 'open') staleReason = 'Session cancelled';
    else if (sessionIsPast(session)) staleReason = 'Session has passed';
    else if (remainingSoFar <= 0) staleReason = 'Session just filled up';
    // Each non-stale row consumes one of this session's remaining seats for the
    // purposes of validating subsequent rows for the same session.
    if (session && !staleReason) {
      remainingForSelection.set(item.sessionId, remainingSoFar - 1);
    }
    return {
      item,
      session,
      remaining: remainingSoFar,
      staleReason,
      cardPortion: 0,
      feeShare: 0,
      creditShare: 0,
      trial: false,
    };
  });

  const validRows = baseRows.filter((r) => !r.staleReason && r.session);
  // Mirrors confirmBookings: the free trial goes on the earliest session.
  const trialRow = freeTrial ? validRows[trialIndex(validRows.map((r) => r.session!))] : undefined;
  if (trialRow) trialRow.trial = true;
  const trialPence = trialRow?.session!.price_pence ?? 0;
  const totalSessionPence = validRows.reduce((sum, r) => sum + (r.session?.price_pence ?? 0), 0);
  const creditAppliedTotal = Math.max(0, Math.min(totalSessionPence - trialPence, balance));

  let remainingCredit = creditAppliedTotal;
  for (const r of validRows) {
    const price = r.trial ? 0 : r.session!.price_pence;
    const take = Math.min(remainingCredit, price);
    r.creditShare = take;
    r.cardPortion = price - take;
    remainingCredit -= take;
  }

  const amountToCharge = validRows.reduce((sum, r) => sum + r.cardPortion, 0);
  const totalFeePence = calculateBookingFeePence(amountToCharge);
  const cardPayment = amountToCharge + totalFeePence;

  const feeShares = allocateFeePence(totalFeePence, validRows.map((r) => r.cardPortion));
  validRows.forEach((r, i) => { r.feeShare = feeShares[i] ?? 0; });

  const blockingStale = baseRows.some((r) => r.staleReason);
  const noChildren = !children || children.length === 0;

  const ageRows: AgeCheckRow[] = validRows.map((r) => ({
    selectName: `child_${r.item.id}`,
    defaultChildId: r.item.childId ?? '',
    date: r.session!.date,
    dateLabel: formatDateWeekday(r.session!.date),
    tooOldIds: (children ?? []).filter((c) => playerTooOld(c, r.session!)).map((c) => c.id),
  }));
  const tooOldIdsByRow = new Map(ageRows.map((a) => [a.selectName, new Set(a.tooOldIds)]));
  const childNames = Object.fromEntries((children ?? []).map((c) => [c.id, c.name]));

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className="font-heading uppercase tracking-[0.18em] text-xs text-accent">Your sessions</p>
        <h1 className="text-2xl font-bold">Review your sessions</h1>
        <p className="text-sm text-fg-muted">
          Assign a player to each line and confirm. You&apos;ll pay once for all of them.
          For siblings on the same session, add the session twice - once per player.
        </p>
      </header>

      {freeTrial && (
        <p className="p-3 bg-[var(--ok-bg)] border border-[var(--ok-line)] text-[var(--ok-fg)] rounded">
          <strong>Your first session is a free trial.</strong>{' '}
          {trialRow
            ? <>We&apos;ve applied it to {formatDate(trialRow.session!.date)} - there&apos;s nothing to pay for that session.</>
            : <>It&apos;ll be applied to the earliest session in your selection.</>}
          {validRows.length > 1 && ' The trial covers one session only, so the others are charged as normal.'}
        </p>
      )}

      {sp.error && (
        <p className="p-3 bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger-fg)] rounded">
          {sp.error}
        </p>
      )}
      {sp.stale && (
        <p className="p-3 bg-[var(--warn-bg)] border border-[var(--warn-line)] text-[var(--warn-fg)] rounded">
          One or more sessions just filled up or were cancelled. Remove the affected lines to continue.
        </p>
      )}

      {noChildren && (
        <p className="p-3 bg-[var(--warn-bg)] border border-[var(--warn-line)] text-[var(--warn-fg)] rounded">
          You need to <Link href="/children">add a player</Link> before you can confirm.
        </p>
      )}

      <form action={confirmBookings} className="space-y-4">
        <AgeWarning rows={ageRows} names={childNames} />
        <div className="overflow-x-auto"><table>
          <thead>
            <tr>
              <th>Session</th>
              <th>Player</th>
              <th>Price</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {baseRows.map((r) => {
              if (!r.session) {
                return (
                  <tr key={r.item.id} className="opacity-60">
                    <td colSpan={2}>
                      <span className="text-[var(--warn-fg)]">Session unavailable</span>
                    </td>
                    <td>-</td>
                    <td className="text-right">
                      <RemoveButton rowId={r.item.id} />
                    </td>
                  </tr>
                );
              }
              const stale = !!r.staleReason;
              return (
                <tr key={r.item.id} className={stale ? 'opacity-60' : ''}>
                  <td>
                    {formatDate(r.session.date)} {formatTime(r.session.start_time)}
                    {r.session.age_group ? ` | ${r.session.age_group}` : ''}
                    {stale && (
                      <div className="text-xs text-[var(--warn-fg)] mt-0.5">{r.staleReason}</div>
                    )}
                  </td>
                  <td>
                    {stale ? (
                      <span className="text-fg-muted">-</span>
                    ) : (
                      <PlayerSelect
                        name={`child_${r.item.id}`}
                        defaultValue={r.item.childId ?? ''}
                        placeholder="Choose a player…"
                        className="w-full"
                        players={(children ?? []).map((c) => ({
                          id: c.id,
                          name: c.name,
                          tooOld: !!tooOldIdsByRow.get(`child_${r.item.id}`)?.has(c.id),
                        }))}
                      />
                    )}
                  </td>
                  <td>
                    {stale ? (
                      <span className="text-fg-muted">-</span>
                    ) : (
                      <>
                        {r.trial ? (
                          <>
                            <s className="text-fg-muted">{formatPence(r.session.price_pence)}</s>{' '}
                            <strong className="text-accent">Free trial</strong>
                          </>
                        ) : (
                          formatPence(r.session.price_pence)
                        )}
                        {r.creditShare > 0 && (
                          <div className="text-xs text-fg-muted">− {formatPence(r.creditShare)} credit</div>
                        )}
                      </>
                    )}
                  </td>
                  <td className="text-right">
                    <RemoveButton rowId={r.item.id} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>

        <section className="p-4 border border-line rounded bg-surface max-w-md ml-auto space-y-1">
          <Line label="Sessions" value={formatPence(totalSessionPence)} />
          {trialPence > 0 && (
            <Line label="Free trial" value={`− ${formatPence(trialPence)}`} muted />
          )}
          {creditAppliedTotal > 0 && (
            <Line label="Credit applied" value={`− ${formatPence(creditAppliedTotal)}`} muted />
          )}
          {totalFeePence > 0 && (
            <Line
              label="Booking fee"
              value={formatPence(totalFeePence)}
              hint="Covers card processing. Non-refundable."
              muted
            />
          )}
          <div className="border-t border-line my-4" />
          <Line
            label={cardPayment > 0 ? 'Card payment' : 'To pay'}
            value={formatPence(cardPayment)}
            strong
          />
        </section>

        <div className="flex flex-wrap items-center gap-3 justify-end pt-3">
          <ValidatedSubmit
            forceDisabled={blockingStale || noChildren || validRows.length === 0}
          >
            {cardPayment > 0 ? 'Continue to payment' : 'Confirm bookings'}
          </ValidatedSubmit>
          {blockingStale && (
            <span className="text-sm text-fg-muted">Remove unavailable lines to continue.</span>
          )}
        </div>
      </form>
    </div>
  );
}

function RemoveButton({ rowId }: { rowId: string }) {
  return (
    <SubmitButton
      name="remove_row_id"
      value={rowId}
      className="bg-transparent border-0 text-fg-muted hover:text-[var(--danger-fg)] text-sm font-normal p-0"
      aria-label="Remove from selection"
    >
      ✕ Remove
    </SubmitButton>
  );
}


function Line({
  label,
  value,
  muted = false,
  strong = false,
  hint,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={`${strong ? 'font-semibold' : ''} ${muted ? 'text-fg-muted' : ''}`}>
        {label}
        {hint && <span className="block text-xs text-fg-muted">{hint}</span>}
      </span>
      <span className={`${strong ? 'font-semibold' : ''} ${muted ? 'text-fg-muted' : ''}`}>
        {value}
      </span>
    </div>
  );
}
