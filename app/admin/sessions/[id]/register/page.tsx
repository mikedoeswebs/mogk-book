import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatDate, formatTime, ageFromDob } from '@/lib/format';
import { ArrowLeft } from '@/lib/ui/Icon';
import type { Booking, Child, Parent, Session } from '@/lib/db/types';

type RegisterBookingRow = Booking & {
  children: Child | null;
  parents: Parent | null;
};

export default async function SessionRegisterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: session } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', id)
    .maybeSingle<Session>();
  if (!session) notFound();

  // A "session" here is one age-group row. The register covers the whole
  // slot, so pull every row sharing the same date+start_time (see the
  // dashboard's "next session" grouping for the same pattern).
  const { data: groupRows } = await supabase
    .from('sessions')
    .select('*')
    .eq('date', session.date)
    .eq('start_time', session.start_time)
    .returns<Session[]>();

  const groups = (groupRows ?? []).slice().sort((a, b) =>
    (b.age_group ?? '').localeCompare(a.age_group ?? ''),
  );
  const groupIds = groups.map((g) => g.id);

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, children(*), parents(*)')
    .in('session_id', groupIds)
    .in('status', ['active', 'awaiting_approval'])
    .returns<RegisterBookingRow[]>();

  const bookingsByGroup = new Map<string, RegisterBookingRow[]>();
  for (const g of groups) bookingsByGroup.set(g.id, []);
  for (const b of bookings ?? []) {
    bookingsByGroup.get(b.session_id)?.push(b);
  }
  for (const rows of bookingsByGroup.values()) {
    rows.sort((a, b) => playerName(a).localeCompare(playerName(b)));
  }

  const coaches = [...new Set(groups.map((g) => g.coach_name))];
  const totalConfirmed = (bookings ?? []).filter((b) => b.status === 'active').length;
  const totalAwaiting = (bookings ?? []).filter((b) => b.status === 'awaiting_approval').length;

  return (
    <div className="space-y-4">
      <p><Link href="/admin/sessions"><ArrowLeft /> Back to sessions</Link></p>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">Register</h1>
        <span className="text-sm text-fg-muted">
          {totalConfirmed} confirmed
          {totalAwaiting > 0 ? `, ${totalAwaiting} awaiting approval` : ''}
        </span>
      </div>

      <p className="text-fg-muted">
        {formatDate(session.date)} &middot; {formatTime(session.start_time)}–{formatTime(session.end_time)}
        {coaches.length > 0 ? ` · ${coaches.join(', ')}` : ''}
      </p>

      {groups.map((g) => {
        const rows = bookingsByGroup.get(g.id) ?? [];
        const confirmed = rows.filter((b) => b.status === 'active').length;
        return (
          <section key={g.id} className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-xl font-bold">{g.age_group ?? 'Group'}</h2>
              <span className="text-sm text-fg-muted">{confirmed}/{g.capacity}</span>
            </div>
            {rows.length === 0 ? (
              <p className="text-sm text-fg-muted">No bookings.</p>
            ) : (
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Age</th>
                      <th className="hidden sm:table-cell">Position</th>
                      <th className="hidden sm:table-cell">Contact</th>
                      <th className="hidden sm:table-cell">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((b) => (
                      <tr key={b.id}>
                        <td>
                          {playerName(b)}
                          {b.is_ghost && (
                            <span className="ml-1.5 text-xs text-fg-muted/70">(ghost)</span>
                          )}
                          {b.status === 'awaiting_approval' && (
                            <span className="ml-1.5 text-xs text-[var(--warn-fg)]">awaiting approval</span>
                          )}
                        </td>
                        <td>{b.children?.dob ? ageFromDob(b.children.dob) : '-'}</td>
                        <td className="hidden sm:table-cell">{b.children?.position ?? '-'}</td>
                        <td className="hidden sm:table-cell">{contactFor(b)}</td>
                        <td className="hidden sm:table-cell">{b.children?.notes ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function playerName(b: RegisterBookingRow): string {
  if (b.is_ghost) return b.trialist_name ?? 'Trialist';
  return b.children?.name ?? 'Unknown player';
}

function contactFor(b: RegisterBookingRow): string {
  if (b.is_ghost) return '-';
  return b.parents?.phone || b.parents?.email || '-';
}
