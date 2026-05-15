import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendWeeklyDigest } from '@/lib/email/send';
import type { Parent, Session } from '@/lib/db/types';

export const runtime = 'nodejs';

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const supabase = createSupabaseAdminClient();

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const sevenDaysOut = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [{ data: parents, error: parentsErr }, { data: sessions, error: sessionsErr }] =
    await Promise.all([
      supabase
        .from('parents')
        .select('*')
        .eq('weekly_emails', true)
        .returns<Parent[]>(),
      supabase
        .from('sessions')
        .select('*')
        .eq('status', 'open')
        .gte('date', todayISO)
        .lte('date', sevenDaysOut)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })
        .returns<Session[]>(),
    ]);

  if (parentsErr) {
    return NextResponse.json({ error: parentsErr.message }, { status: 500 });
  }
  if (sessionsErr) {
    return NextResponse.json({ error: sessionsErr.message }, { status: 500 });
  }

  const recipients = parents ?? [];
  const upcoming = sessions ?? [];

  if (recipients.length === 0 || upcoming.length === 0) {
    return NextResponse.json({
      recipients: recipients.length,
      sessions: upcoming.length,
      sent: 0,
      failed: 0,
    });
  }

  const siteUrl = getSiteUrl();
  const results = await Promise.allSettled(
    recipients.map((parent) =>
      sendWeeklyDigest({ parent, sessions: upcoming, siteUrl }),
    ),
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.length - sent;
  return NextResponse.json({
    recipients: recipients.length,
    sessions: upcoming.length,
    sent,
    failed,
  });
}
