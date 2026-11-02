import Link from 'next/link';
import { requireParent } from '@/lib/auth/require-parent';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCreditBalance } from '@/lib/booking/credits';
import { hasFreeTrial } from '@/lib/booking/trial';
import { sessionIsPast } from '@/lib/booking/rules';
import { MILESTONES, countsAsAttended, nextMilestone } from '@/lib/booking/milestones';
import { formatDateWeekday, formatPence, formatTime } from '@/lib/format';
import { ArrowRight } from '@/lib/ui/Icon';
import type { Booking, Child, Session } from '@/lib/db/types';

// Explicit columns: parents never need session_report_notes.
const SESSION_COLS = 'id, date, start_time, end_time, age_group, location, status, starts_at';

type DashSession = Pick<
  Session,
  'id' | 'date' | 'start_time' | 'end_time' | 'age_group' | 'location' | 'status' | 'starts_at'
>;
type DashBooking = Pick<Booking, 'id' | 'status' | 'attended' | 'child_id' | 'is_free_trial'> & {
  sessions: DashSession;
  children: Pick<Child, 'name'> | null;
};

const UPCOMING_SHOWN = 3;

export default async function DashboardPage() {
  const parent = await requireParent();
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const [{ data: bookingRows }, { data: childRows }, { data: waitRows }, balance, freeTrial] =
    await Promise.all([
      supabase
        .from('bookings')
        .select(`id, status, attended, child_id, is_free_trial, sessions!session_id(${SESSION_COLS}), children(name)`)
        .eq('parent_id', parent.id)
        .in('status', ['pending_payment', 'awaiting_approval', 'active'])
        .returns<DashBooking[]>(),
      supabase
        .from('children')
        .select('id, name, notes, medical_consent_at')
        .eq('parent_id', parent.id)
        .order('created_at', { ascending: true })
        .returns<Pick<Child, 'id' | 'name' | 'notes' | 'medical_consent_at'>[]>(),
      supabase
        .from('waitlist_entries')
        .select('id, sessions!session_id(starts_at)')
        .eq('parent_id', parent.id)
        .returns<{ id: string; sessions: Pick<Session, 'starts_at'> }[]>(),
      getCreditBalance(admin, parent.id),
      hasFreeTrial(admin, parent),
    ]);

  const bookings = (bookingRows ?? []).filter((b) => b.sessions);
  const children = childRows ?? [];

  const upcoming = bookings
    .filter((b) => b.status !== 'pending_payment' && !sessionIsPast(b.sessions))
    .sort((a, b) => a.sessions.starts_at.localeCompare(b.sessions.starts_at));
  const unpaid = bookings.filter((b) => b.status === 'pending_payment' && !sessionIsPast(b.sessions));
  const cancelledByUs = upcoming.filter((b) => b.sessions.status === 'cancelled');
  const waiting = (waitRows ?? []).filter((w) => w.sessions && !sessionIsPast(w.sessions)).length;
  const needsConsent = children.filter((c) => c.notes && !c.medical_consent_at);

  const attendedByChild = new Map<string, number>();
  for (const b of bookings) {
    if (b.child_id && countsAsAttended(b, b.sessions)) {
      attendedByChild.set(b.child_id, (attendedByChild.get(b.child_id) ?? 0) + 1);
    }
  }

  const firstName = parent.name?.split(' ')[0];
  const upcomingCount = upcoming.length - cancelledByUs.length;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">{firstName ? `Hi ${firstName}` : 'Dashboard'}</h1>

      {/* Things that need the parent's attention. Only rendered when there is something to say. */}
      <div className="space-y-2 empty:hidden">
        {children.length === 0 && (
          <Notice kind="info" href="/children" action="Add a player">
            Add your first player to start booking sessions.
          </Notice>
        )}
        {cancelledByUs.map((b) => (
          <Notice key={b.id} kind="danger">
            {formatDateWeekday(b.sessions.date)} {formatTime(b.sessions.start_time)}
            {b.children ? ` (${b.children.name})` : ''} has been cancelled and is not taking place.
          </Notice>
        ))}
        {unpaid.length > 0 && (
          <Notice kind="warn" href="/bookings" action="View">
            {unpaid.length} booking{unpaid.length === 1 ? ' is' : 's are'} waiting for payment and
            {unpaid.length === 1 ? ' is' : ' are'} not confirmed yet.
          </Notice>
        )}
        {needsConsent.map((c) => (
          <Notice key={c.id} kind="warn" href={`/children/${c.id}`} action="Review">
            Please review and confirm {c.name}&apos;s medical information.
          </Notice>
        ))}
        {freeTrial && children.length > 0 && (
          <Notice kind="ok" href="/sessions" action="Book">
            Your first session is a free trial.
          </Notice>
        )}
        {balance > 0 && (
          <Notice kind="info" href="/sessions" action="Book">
            You have {formatPence(balance)} of credit, applied automatically to your next booking.
          </Notice>
        )}
      </div>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold">Coming up</h2>
          {upcoming.length > UPCOMING_SHOWN && (
            <Link href="/bookings" className="text-sm">All {upcoming.length} bookings <ArrowRight /></Link>
          )}
        </div>
        {upcoming.length === 0 ? (
          <p className="text-fg-muted">
            Nothing booked. <Link href="/sessions">Browse sessions</Link>.
          </p>
        ) : (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {upcoming.slice(0, UPCOMING_SHOWN).map((b) => (
              <UpcomingCard key={b.id} booking={b} />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Manage</h2>
        <ul className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <QuickLink href="/sessions" title="Book a session" primary>
            Browse dates and book for your players
          </QuickLink>
          <QuickLink href="/bookings" title="My bookings">
            {upcomingCount} upcoming
            {waiting > 0 ? `, ${waiting} on a waiting list` : ''}. Cancel, move or get receipts
          </QuickLink>
          <QuickLink href="/children" title="My players">
            {children.length} player{children.length === 1 ? '' : 's'}. Details, medical info and badges
          </QuickLink>
          <QuickLink href="/bookings#credit" title="Credit">
            {formatPence(balance)} available
          </QuickLink>
          <QuickLink href="/account" title="My account">
            Contact details and email preferences
          </QuickLink>
          <QuickLink href="/account/help" title="Help">
            Cancellations, credit and how booking works
          </QuickLink>
        </ul>
      </section>

      {children.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Your players</h2>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {children.map((c) => (
              <PlayerCard key={c.id} id={c.id} name={c.name} attended={attendedByChild.get(c.id) ?? 0} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const NOTICE_CLS = {
  info: 'bg-[var(--info-bg)] border-[var(--info-line)] text-[var(--info-fg)]',
  ok: 'bg-[var(--ok-bg)] border-[var(--ok-line)] text-[var(--ok-fg)]',
  warn: 'bg-[var(--warn-bg)] border-[var(--warn-line)] text-[var(--warn-fg)]',
  danger: 'bg-[var(--danger-bg)] border-[var(--danger-line)] text-[var(--danger-fg)]',
};

function Notice({
  kind,
  href,
  action,
  children,
}: {
  kind: keyof typeof NOTICE_CLS;
  href?: string;
  action?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`p-3 border rounded flex flex-wrap items-center justify-between gap-2 ${NOTICE_CLS[kind]}`}>
      <p>{children}</p>
      {href && action && (
        <Link href={href} className="text-sm font-heading uppercase font-bold whitespace-nowrap">
          {action} <ArrowRight />
        </Link>
      )}
    </div>
  );
}

function UpcomingCard({ booking: b }: { booking: DashBooking }) {
  const s = b.sessions;
  const cancelled = s.status === 'cancelled';
  return (
    <li className={`p-4 border border-line rounded bg-surface space-y-1 ${cancelled ? 'opacity-60' : ''}`}>
      <p className={`font-heading font-bold ${cancelled ? 'line-through' : ''}`}>
        {formatDateWeekday(s.date)}
      </p>
      <p className="text-sm">
        {formatTime(s.start_time)}–{formatTime(s.end_time)}
        {s.age_group ? ` · ${s.age_group}` : ''}
      </p>
      <p className="text-sm text-fg-muted">{s.location}</p>
      <p className="text-sm">
        {b.children?.name}
        {cancelled ? (
          <span className="ml-2 text-xs font-bold uppercase text-[var(--danger-fg)]">Cancelled</span>
        ) : b.status === 'awaiting_approval' ? (
          <span className="ml-2 text-xs text-[var(--warn-fg)]">Awaiting approval</span>
        ) : b.is_free_trial ? (
          <span className="ml-2 text-xs text-fg-muted">Free trial</span>
        ) : null}
      </p>
    </li>
  );
}

function QuickLink({
  href,
  title,
  primary = false,
  children,
}: {
  href: string;
  title: string;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className={`block h-full p-4 rounded border no-underline! transition-colors ${
          primary
            ? 'bg-accent border-accent text-accent-ink! hover:bg-accent-hover'
            : 'bg-surface border-line text-fg! hover:bg-surface-2'
        }`}
      >
        <span className="block font-heading uppercase font-bold tracking-wide">
          {title} <ArrowRight />
        </span>
        <span className={`block text-sm mt-1 ${primary ? '' : 'text-fg-muted'}`}>{children}</span>
      </Link>
    </li>
  );
}

function PlayerCard({ id, name, attended }: { id: string; name: string; attended: number }) {
  const next = nextMilestone(attended);
  // Progress from the previous badge (or zero) towards the next one.
  const prev = MILESTONES.findLast((m) => m <= attended) ?? 0;
  const pct = next === undefined ? 100 : Math.round(((attended - prev) / (next - prev)) * 100);
  return (
    <li>
      <Link
        href={`/children/${id}`}
        className="block h-full p-4 rounded border border-line bg-surface no-underline! text-fg! hover:bg-surface-2 transition-colors space-y-2"
      >
        <span className="block font-heading uppercase font-bold tracking-wide">{name}</span>
        <span className="block text-sm">
          <strong className="text-lg">{attended}</strong> session{attended === 1 ? '' : 's'} attended
        </span>
        <span className="block h-1.5 rounded bg-surface-2 overflow-hidden" aria-hidden="true">
          <span className="block h-full bg-accent" style={{ width: `${pct}%` }} />
        </span>
        <span className="block text-xs text-fg-muted">
          {next === undefined ? 'Every badge earned' : `${next - attended} to the ${next}-session badge`}
        </span>
      </Link>
    </li>
  );
}
