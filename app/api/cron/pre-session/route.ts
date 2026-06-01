import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendAdminSessionRoster } from '@/lib/email/send';
import type { Session } from '@/lib/db/types';

export const runtime = 'nodejs';

// Roster alert ~3 hours before each session. Vercel Hobby can't run a cron more
// than once a day, so this endpoint is polled every ~15 min by an external
// scheduler (secured by CRON_SECRET). The 30-minute window plus the
// admin_roster_sent_at column mean each session is emailed exactly once.

type RosterBookingRow = {
  session_id: string;
  is_ghost: boolean;
  trialist_name: string | null;
  children: { name: string } | null;
};

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const supabase = createSupabaseAdminClient();
  const now = Date.now();
  const windowStart = new Date(now + 2 * 60 * 60 * 1000 + 45 * 60 * 1000).toISOString();
  const windowEnd = new Date(now + 3 * 60 * 60 * 1000 + 15 * 60 * 1000).toISOString();

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('status', 'open')
    .is('admin_roster_sent_at', null)
    .gte('starts_at', windowStart)
    .lte('starts_at', windowEnd)
    .order('start_time', { ascending: true })
    .returns<Session[]>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ slots: 0, sent: 0, failed: 0 });
  }

  const sessionIds = sessions.map((s) => s.id);
  const { data: bookings } = await supabase
    .from('bookings')
    .select('session_id, is_ghost, trialist_name, children(name)')
    .in('session_id', sessionIds)
    .eq('status', 'active')
    .returns<RosterBookingRow[]>();

  const playersBySession = new Map<string, string[]>();
  for (const b of bookings ?? []) {
    const name = b.is_ghost
      ? (b.trialist_name ?? 'Trialist')
      : (b.children?.name ?? 'Unknown player');
    const list = playersBySession.get(b.session_id) ?? [];
    list.push(name);
    playersBySession.set(b.session_id, list);
  }

  // Group sessions that share a date + start_time into one roster email
  // (a slot can hold several age groups, e.g. Main + Academy).
  type Slot = { date: string; start_time: string; end_time: string; sessions: Session[] };
  const slotMap = new Map<string, Slot>();
  for (const s of sessions) {
    const key = `${s.date}|${s.start_time}`;
    let slot = slotMap.get(key);
    if (!slot) {
      slot = { date: s.date, start_time: s.start_time, end_time: s.end_time, sessions: [] };
      slotMap.set(key, slot);
    }
    slot.sessions.push(s);
  }
  const slots = Array.from(slotMap.values());

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const results = await Promise.allSettled(
    slots.map((slot) =>
      sendAdminSessionRoster({
        date: slot.date,
        startTime: slot.start_time,
        endTime: slot.end_time,
        // Z-A by age group so the order is deterministic (Main before Academy).
        groups: slot.sessions
          .slice()
          .sort((a, b) => (b.age_group ?? '').localeCompare(a.age_group ?? ''))
          .map((s) => ({
            ageGroup: s.age_group,
            players: (playersBySession.get(s.id) ?? [])
              .slice()
              .sort((x, y) => x.localeCompare(y)),
          })),
        siteUrl,
      }),
    ),
  );

  // Only mark sessions whose roster actually went out, so a transient send
  // failure gets another attempt on the next poll (still inside the window).
  const sentSessionIds: string[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      sentSessionIds.push(...slots[i].sessions.map((s) => s.id));
    }
  });
  if (sentSessionIds.length > 0) {
    await supabase
      .from('sessions')
      .update({ admin_roster_sent_at: new Date(now).toISOString() })
      .in('id', sentSessionIds);
  }

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  return NextResponse.json({ slots: slots.length, sent, failed: results.length - sent });
}
