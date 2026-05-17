import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendReminder, sendUpcomingSessionPrompt } from '@/lib/email/send';
import type { Booking, Session, Parent, Child } from '@/lib/db/types';

export const runtime = 'nodejs';

type Supabase = ReturnType<typeof createSupabaseAdminClient>;

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
  const todayISO = new Date(now).toISOString().slice(0, 10);
  const tomorrow = new Date(now + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const dayAfterTomorrow = new Date(now + 2 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const reminders = await runReminders(supabase, tomorrow);
  if ('error' in reminders) {
    return NextResponse.json({ error: reminders.error }, { status: 500 });
  }

  const prompts = await runUpcomingPrompts(supabase, dayAfterTomorrow, todayISO);
  if ('error' in prompts) {
    return NextResponse.json({ error: prompts.error }, { status: 500 });
  }

  return NextResponse.json({
    reminders: { date: tomorrow, ...reminders },
    prompts: { date: dayAfterTomorrow, ...prompts },
  });
}

// ---- 24-hour-out reminders (existing behaviour) ----

async function runReminders(supabase: Supabase, tomorrow: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, sessions!inner(*), children(*), parents(*)')
    .eq('status', 'active')
    .eq('sessions.date', tomorrow)
    .returns<(Booking & { sessions: Session; children: Child; parents: Parent })[]>();

  if (error) return { error: error.message };

  const results = await Promise.allSettled(
    (data ?? []).map((row) =>
      sendReminder({
        booking: row,
        session: row.sessions,
        parent: row.parents,
        child: row.children,
      }),
    ),
  );
  const sent = results.filter((r) => r.status === 'fulfilled').length;
  return { sent, failed: results.length - sent };
}

// ---- "Book the next one" prompt (~48h before session start) ----
//
// For each upcoming session two days from now, find the most recent past
// session in the same series (same age_group + start_time) and email anyone
// who had an active, non-ghost booking on it and is opted into emails.

async function runUpcomingPrompts(
  supabase: Supabase,
  dayAfterTomorrow: string,
  todayISO: string,
) {
  const { data: upcoming, error: upcomingErr } = await supabase
    .from('sessions')
    .select('*')
    .eq('status', 'open')
    .eq('date', dayAfterTomorrow)
    .returns<Session[]>();
  if (upcomingErr) return { error: upcomingErr.message };
  if (!upcoming || upcoming.length === 0) {
    return { sessions: 0, recipients: 0, sent: 0, failed: 0 };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const perParent = new Map<string, { parent: Parent; sessions: Session[] }>();

  for (const next of upcoming) {
    let prevQ = supabase
      .from('sessions')
      .select('id')
      .lt('date', todayISO)
      .eq('start_time', next.start_time)
      .eq('status', 'open')
      .order('date', { ascending: false })
      .limit(1);
    prevQ = next.age_group === null
      ? prevQ.is('age_group', null)
      : prevQ.eq('age_group', next.age_group);
    const { data: prev } = await prevQ.returns<{ id: string }[]>();
    if (!prev || prev.length === 0) continue;

    const { data: prevBookings } = await supabase
      .from('bookings')
      .select('parent_id, parents!inner(*)')
      .eq('session_id', prev[0].id)
      .eq('status', 'active')
      .eq('is_ghost', false)
      .eq('parents.weekly_emails', true)
      .returns<{ parent_id: string; parents: Parent }[]>();
    if (!prevBookings) continue;

    for (const b of prevBookings) {
      const existing = perParent.get(b.parent_id);
      if (existing) {
        if (!existing.sessions.some((s) => s.id === next.id)) {
          existing.sessions.push(next);
        }
      } else {
        perParent.set(b.parent_id, { parent: b.parents, sessions: [next] });
      }
    }
  }

  const results = await Promise.allSettled(
    Array.from(perParent.values()).map(({ parent, sessions }) =>
      sendUpcomingSessionPrompt({ parent, sessions, siteUrl }),
    ),
  );
  const sent = results.filter((r) => r.status === 'fulfilled').length;
  return {
    sessions: upcoming.length,
    recipients: perParent.size,
    sent,
    failed: results.length - sent,
  };
}
