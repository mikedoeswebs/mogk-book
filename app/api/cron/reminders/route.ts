import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendReminder } from '@/lib/email/send';
import type { Booking, Session, Parent, Child } from '@/lib/db/types';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const supabase = createSupabaseAdminClient();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data, error } = await supabase
    .from('bookings')
    .select('*, sessions!inner(*), children(*), parents(*)')
    .eq('status', 'active')
    .eq('sessions.date', tomorrow)
    .returns<(Booking & { sessions: Session; children: Child; parents: Parent })[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

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
  const failed = results.length - sent;
  return NextResponse.json({ date: tomorrow, sent, failed });
}
