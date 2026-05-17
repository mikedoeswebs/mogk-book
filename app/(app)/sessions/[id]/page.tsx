import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireParent } from '@/lib/auth/require-parent';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCreditBalance, applyCredit } from '@/lib/booking/credits';
import { bookingFeeFor } from '@/lib/booking/fees';
import { bookingNeedsApproval, sessionIsPast } from '@/lib/booking/rules';
import { formatDate, formatTime, formatPence } from '@/lib/format';
import { ArrowLeft } from '@/lib/ui/Icon';
import { SubmitButton } from '@/lib/ui/SubmitButton';
import type { Child, Session } from '@/lib/db/types';
import { countSessionInSelection } from '@/lib/booking/selection';
import { addToSelection } from '../selection-actions';
import { createCheckoutSession } from './actions';

export default async function SessionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const parent = await requireParent();
  const { id } = await params;
  const sp = await searchParams;

  const supabase = await createSupabaseServerClient();
  const { data: session } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', id)
    .maybeSingle<Session>();

  if (!session) notFound();

  const { data: children } = await supabase
    .from('children')
    .select('*')
    .eq('parent_id', parent.id)
    .order('name', { ascending: true })
    .returns<Child[]>();

  const { data: availability } = await supabase.rpc('get_session_availability', {
    p_session_ids: [session.id],
  });
  const remaining = (availability as { session_id: string; remaining: number }[] | null)?.[0]
    ?.remaining ?? session.capacity;

  const admin = createSupabaseAdminClient();
  const balance = await getCreditBalance(admin, parent.id);
  const { creditApplied, amountToCharge } = applyCredit(session.price_pence, balance);
  const feePence = bookingFeeFor(amountToCharge);
  const totalToCharge = amountToCharge + feePence;
  const needsApproval = bookingNeedsApproval(session);

  const isPast = sessionIsPast(session);
  const sessionClosed = session.status !== 'open';
  const noChildren = !children || children.length === 0;
  const inSelection = await countSessionInSelection(session.id);

  return (
    <div className="space-y-4">
      <p><Link href="/sessions"><ArrowLeft /> Back to sessions</Link></p>
      <h1 className="text-2xl font-bold">Session details</h1>

      {sp.error && (
        <p className="p-3 bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger-fg)] rounded">{sp.error}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <section className="p-4 bg-surface border border-line rounded">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1">
            <dt className="font-bold">Date</dt><dd>{formatDate(session.date)}</dd>
            <dt className="font-bold">Time</dt><dd>{formatTime(session.start_time)}–{formatTime(session.end_time)}</dd>
            <dt className="font-bold">Location</dt><dd>{session.location}</dd>
            <dt className="font-bold">{session.coach_name.includes(',') ? 'Coaches' : 'Coach'}</dt><dd>{session.coach_name}</dd>
            {session.age_group && (<><dt className="font-bold">Group</dt><dd>{session.age_group}</dd></>)}
            <dt className="font-bold">Price</dt><dd>{formatPence(session.price_pence)}</dd>
            <dt className="font-bold">Availability</dt><dd>{remaining > 0 ? `${remaining} of ${session.capacity} spots left` : 'Sold out'}</dd>
            {session.notes && (<><dt>Notes</dt><dd>{session.notes}</dd></>)}
          </dl>
        </section>

        <section className="space-y-4">
          {isPast ? (
            <p className="p-3 bg-surface-2 border border-line rounded text-fg-muted">
              This session has already taken place and can no longer be booked.
            </p>
          ) : (
            <>
              {needsApproval && (
                <p className="p-3 bg-[var(--warn-bg)] border border-[var(--warn-line)] text-[var(--warn-fg)] rounded">
                  This session starts in under 24 hours. Your booking will be paid for now but won&apos;t be
                  confirmed until an admin approves it. If rejected, you&apos;ll be refunded in full.
                </p>
              )}

              {balance > 0 && (
                <p className="p-3 bg-[var(--info-bg)] border border-[var(--info-line)] text-[var(--info-fg)] rounded">
                  You have <strong>{formatPence(balance)}</strong> in credit.{' '}
                  {creditApplied > 0 && (
                    <>
                      {formatPence(creditApplied)} will be applied to this booking
                      {amountToCharge > 0
                        ? `, leaving ${formatPence(amountToCharge)} to pay.`
                        : ' - no card payment needed.'}
                    </>
                  )}
                </p>
              )}

              {amountToCharge > 0 && (
                <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 p-3 bg-surface border border-line rounded">
                  <dt className="font-bold">Session</dt><dd>{formatPence(session.price_pence)}</dd>
                  {creditApplied > 0 && (
                    <>
                      <dt className="font-bold">Credit applied</dt>
                      <dd>− {formatPence(creditApplied)}</dd>
                    </>
                  )}
                  <dt className="font-bold">Booking fee</dt>
                  <dd>
                    {formatPence(feePence)}{' '}
                    <span className="text-xs pl-2 text-fg-muted">(covers card processing, non-refundable)</span>
                  </dd>
                  <dt className="font-bold text-lg pt-2">Card payment</dt>
                  <dd className="font-bold text-lg pt-2">{formatPence(totalToCharge)}</dd>
                </dl>
              )}

              {sessionClosed ? (
                <p>This session is closed.</p>
              ) : remaining <= 0 ? (
                <p>This session is fully booked.</p>
              ) : noChildren ? (
                <p>
                  You need to <Link href="/children">add a player</Link> before you can book.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-surface border border-line rounded space-y-3">
                    <div>
                      <h2 className="text-lg font-bold capitalize">Booking more than one?</h2>
                      <p className="text-sm text-fg-muted mt-1">
                        Adding multiple players, or booking several sessions in one go? Build a selection and pay for everything together. A booking fee will apply once for the whole transaction.
                      </p>
                    </div>
                    <form action={addToSelection}>
                      <input type="hidden" name="session_id" value={session.id} />
                      <SubmitButton className="w-full" pendingLabel="Adding…">
                        {inSelection > 0
                          ? `+ Add another to selection (${inSelection} already)`
                          : '+ Add to selection'}
                      </SubmitButton>
                    </form>
                  </div>

                  <div className="mt-6 pt-6 border-t border-line space-y-4">
                    <div>
                      <h3 className="font-semibold">Just this one booking?</h3>
                      <p className="text-sm text-fg-muted mt-1">
                        Skip the selection and check out for a single player now.
                      </p>
                    </div>
                    <form action={createCheckoutSession} className="space-y-3">
                      <input type="hidden" name="session_id" value={session.id} />
                      <label className="block">
                        <span className="block mb-1 text-sm">Book for which player?</span>
                        <select name="child_id" required className="w-full">
                          {children!.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <SubmitButton
                        className="w-full bg-transparent border border-line text-fg hover:border-accent text-sm font-normal"
                        pendingLabel={totalToCharge === 0 ? 'Confirming…' : 'Redirecting to checkout…'}
                      >
                        {totalToCharge === 0
                          ? `Confirm booking (${formatPence(creditApplied)} credit)`
                          : creditApplied > 0
                          ? `Quick checkout (${formatPence(totalToCharge)} + ${formatPence(creditApplied)} credit)`
                          : `Quick checkout (${formatPence(totalToCharge)})`}
                      </SubmitButton>
                    </form>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
