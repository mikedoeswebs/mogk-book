import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatDate, formatTime } from '@/lib/format';
import { ArrowLeft } from '@/lib/ui/Icon';
import { SubmitButton } from '@/lib/ui/SubmitButton';
import type { Booking, Child, Parent, Session } from '@/lib/db/types';
import { saveSessionReport } from './actions';

type BookingRow = Booking & {
  children: Child | null;
  parents: Parent | null;
};

export default async function SessionReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = createSupabaseAdminClient();

  const { data: session } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', id)
    .maybeSingle<Session>();
  if (!session) notFound();

  // Pull active bookings AND bookings cancelled within the 24-hour window
  // (paid but didn't attend). Those still belong on the historical record
  // for this session, just non-editable.
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, children(*), parents(*)')
    .eq('session_id', id)
    .or('status.eq.active,and(status.eq.cancelled,cancellation_outcome.eq.no_refund_late)')
    .order('is_ghost', { ascending: true })
    .returns<BookingRow[]>();

  const all = bookings ?? [];
  const active = all.filter((b) => b.status === 'active');
  const cancelledLate = all.filter((b) => b.status === 'cancelled');

  function playerName(b: BookingRow): string {
    if (b.is_ghost) return b.trialist_name ?? 'Trialist';
    return b.children?.name ?? 'Unknown';
  }

  function playerCell(b: BookingRow, opts: { cancelledLate?: boolean } = {}) {
    return (
      <>
        {playerName(b)}
        {b.is_ghost && (
          <span className="ml-1.5 text-xs text-fg-muted/70">(ghost)</span>
        )}
        {opts.cancelledLate && (
          <span className="ml-1.5 text-xs text-[var(--warn-fg)]">cancelled late</span>
        )}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <p><Link href="/admin/sessions"><ArrowLeft /> Back to sessions</Link></p>
      <h1 className="text-2xl font-bold">Session report</h1>

      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1">
        <dt>Session</dt>
        <dd>
          {formatDate(session.date)} {formatTime(session.start_time)}–{formatTime(session.end_time)}
          {session.age_group ? ` | ${session.age_group}` : ''} | {session.coach_name}
        </dd>
        <dt>Confirmed</dt><dd>{active.length} {active.length === 1 ? 'booking' : 'bookings'}</dd>
        {cancelledLate.length > 0 && (
          <>
            <dt>Cancelled late</dt>
            <dd>
              {`${cancelledLate.length} paid ${cancelledLate.length === 1 ? 'booking' : 'bookings'} - didn't attend`}
            </dd>
          </>
        )}
      </dl>

      {sp.error && <p className="p-3 bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger-fg)] rounded">{sp.error}</p>}
      {sp.success && <p className="p-3 bg-[var(--ok-bg)] border border-[var(--ok-line)] text-[var(--ok-fg)] rounded">{sp.success}</p>}

      {all.length === 0 ? (
        <p>No confirmed bookings to record against.</p>
      ) : (
        <form action={saveSessionReport} className="space-y-5">
          <input type="hidden" name="session_id" value={session.id} />

          <section className="space-y-2">
            <h2 className="text-xl font-bold">Attendance</h2>
            <div className="overflow-x-auto"><table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Present</th>
                  <th>Missed</th>
                  <th>Not recorded</th>
                </tr>
              </thead>
              <tbody>
                {active.map((b) => {
                  const v = b.attended === true ? 'present' : b.attended === false ? 'missed' : 'unset';
                  return (
                    <tr key={b.id}>
                      <td>{playerCell(b)}</td>
                      <td><input type="radio" name={`attended_${b.id}`} value="present" defaultChecked={v === 'present'} /></td>
                      <td><input type="radio" name={`attended_${b.id}`} value="missed" defaultChecked={v === 'missed'} /></td>
                      <td><input type="radio" name={`attended_${b.id}`} value="unset" defaultChecked={v === 'unset'} /></td>
                    </tr>
                  );
                })}
                {cancelledLate.map((b) => (
                  <tr key={b.id} className="opacity-60">
                    <td>{playerCell(b, { cancelledLate: true })}</td>
                    <td><input type="radio" disabled /></td>
                    <td><input type="radio" disabled checked readOnly /></td>
                    <td><input type="radio" disabled /></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            {cancelledLate.length > 0 && (
              <p className="text-xs text-fg-muted">
                Cancelled-late bookings are paid but didn&apos;t attend - they&apos;re fixed in the record and can&apos;t be edited here.
              </p>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">Awards</h2>
            <p className="text-sm text-fg-muted">
              Captain and Player of the Week must be marked Present above. Save attendance first if you change selections.
            </p>

            <div className="flex flex-wrap gap-4">
              <label className="block flex-1 min-w-[240px]">
                <span className="block mb-1">Captain</span>
                <select name="captain_booking_id" defaultValue={session.captain_booking_id ?? ''} className="w-full">
                  <option value="">- None -</option>
                  {active.map((b) => (
                    <option key={b.id} value={b.id}>{playerName(b)}</option>
                  ))}
                </select>
              </label>
              <label className="block flex-1 min-w-[240px]">
                <span className="block mb-1">Player of the Week</span>
                <select name="player_of_week_booking_id" defaultValue={session.player_of_week_booking_id ?? ''} className="w-full">
                  <option value="">- None -</option>
                  {active.map((b) => (
                    <option key={b.id} value={b.id}>{playerName(b)}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <label className="block max-w-2xl">
            <span className="block mb-1">Session notes (internal)</span>
            <textarea
              name="session_report_notes"
              rows={3}
              defaultValue={session.session_report_notes ?? ''}
              className="w-full"
            />
          </label>

          <SubmitButton pendingLabel="Saving…">Save report</SubmitButton>
        </form>
      )}
    </div>
  );
}
