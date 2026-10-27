import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatDate, formatTime, formatPence } from '@/lib/format';
import { ArrowLeft } from '@/lib/ui/Icon';
import { SubmitButton } from '@/lib/ui/SubmitButton';
import type { Child, Parent, Session } from '@/lib/db/types';
import { createAdminBooking } from './actions';

type ChildRow = Child & { parents: Parent };

export default async function NewAdminBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; session?: string; error?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const isGhost = sp.mode === 'ghost';
  const presetSessionId = sp.session ?? '';

  const supabase = createSupabaseAdminClient();
  const todayISO = new Date().toISOString().slice(0, 10);

  const [{ data: sessions }, { data: children }] = await Promise.all([
    supabase
      .from('sessions')
      .select('*')
      .eq('status', 'open')
      .gte('date', todayISO)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
      .returns<Session[]>(),
    supabase
      .from('children')
      .select('*, parents(*)')
      .order('name', { ascending: true })
      .returns<ChildRow[]>(),
  ]);

  const sessionIds = (sessions ?? []).map((s) => s.id);
  const remaining = new Map<string, number>();
  if (sessionIds.length > 0) {
    const { data: availability } = await supabase.rpc('get_session_availability', {
      p_session_ids: sessionIds,
    });
    for (const a of (availability ?? []) as { session_id: string; remaining: number }[]) {
      remaining.set(a.session_id, a.remaining);
    }
  }

  return (
    <div className="space-y-4">
      <p><Link href="/admin/bookings"><ArrowLeft /> Back to bookings</Link></p>
      <h1 className="text-2xl font-bold">New booking</h1>

      <div className="inline-flex border border-line rounded overflow-hidden" role="tablist">
        <Link
          href={`/admin/bookings/new${presetSessionId ? `?session=${presetSessionId}` : ''}`}
          className={`px-3 py-1 text-sm no-underline ${!isGhost ? 'bg-accent text-accent-ink' : 'text-fg-muted hover:bg-surface-2'}`}
          role="tab"
          aria-selected={!isGhost}
        >
          Real player
        </Link>
        <Link
          href={`/admin/bookings/new?mode=ghost${presetSessionId ? `&session=${presetSessionId}` : ''}`}
          className={`px-3 py-1 text-sm no-underline ${isGhost ? 'bg-accent text-accent-ink' : 'text-fg-muted hover:bg-surface-2'}`}
          role="tab"
          aria-selected={isGhost}
        >
          Ghost
        </Link>
      </div>

      {sp.error && (
        <p className="p-3 bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger-fg)] rounded">{sp.error}</p>
      )}

      <form action={createAdminBooking} className="space-y-3 max-w-md">
        <input type="hidden" name="is_ghost" value={isGhost ? '1' : '0'} />

        <label className="block">
          <span className="block mb-1">Session</span>
          <select name="session_id" required defaultValue={presetSessionId} className="w-full">
            <option value="">Choose a session…</option>
            {(sessions ?? []).map((s) => {
              const left = remaining.get(s.id) ?? s.capacity;
              const sold = left <= 0;
              return (
                <option key={s.id} value={s.id} disabled={sold}>
                  {formatDate(s.date)} {formatTime(s.start_time)}
                  {s.age_group ? ` | ${s.age_group}` : ''}
                  {' - '}
                  {sold ? 'Full' : `${left} of ${s.capacity} left`}
                  {' | '}{formatPence(s.price_pence)}
                </option>
              );
            })}
          </select>
        </label>

        {isGhost ? (
          <label className="block">
            <span className="block mb-1">Trialist name</span>
            <input
              type="text"
              name="trialist_name"
              required
              placeholder="e.g. Sam Trial"
              className="w-full"
            />
          </label>
        ) : (
          <label className="block">
            <span className="block mb-1">Player (with parent)</span>
            <select name="child_id" required className="w-full">
              <option value="">Choose a player…</option>
              {(children ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} - {c.parents?.name ?? 'Unknown parent'}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex gap-3">
          <label className="block flex-1">
            <span className="block mb-1">Paid amount (£)</span>
            <input
              type="number"
              name="amount"
              min={0}
              step="0.01"
              required
              defaultValue="0.00"
              className="w-full"
            />
          </label>
          <label className="block flex-1">
            <span className="block mb-1">Payment method</span>
            <select name="payment_method" required defaultValue="cash" className="w-full">
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="free">Free</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>

        {!isGhost && (
          <label className="block">
            <span className="block mb-1">Credit to apply (£, optional)</span>
            <input
              type="number"
              name="credit_applied"
              min={0}
              step="0.01"
              defaultValue="0.00"
              className="w-full"
            />
          </label>
        )}

        <label className="block">
          <span className="block mb-1">Payment note (optional)</span>
          <textarea name="payment_note" rows={2} className="w-full" placeholder="e.g. cheque #1234" />
        </label>

        <SubmitButton pendingLabel="Creating…">Create booking</SubmitButton>
      </form>
    </div>
  );
}
