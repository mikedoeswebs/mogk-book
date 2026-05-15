import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Booking, Session, Parent, Child } from '@/lib/db/types';

type Row = Booking & {
  sessions: Session;
  children: Child | null;
  parents: Parent | null;
};

export async function GET() {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('bookings')
    .select('*, sessions(*), children(*), parents(*)')
    .order('created_at', { ascending: false })
    .returns<Row[]>();

  const header = [
    'booking_id',
    'created_at',
    'status',
    'amount_pence',
    'booking_fee_pence',
    'payment_method',
    'payment_note',
    'is_ghost',
    'trialist_name',
    'session_date',
    'session_start',
    'session_end',
    'coach',
    'player_name',
    'parent_name',
    'parent_email',
    'parent_phone',
    'stripe_payment_intent',
  ].join(',');

  const rows = (data ?? []).map((b) =>
    [
      b.id,
      b.created_at,
      b.status,
      b.amount_pence,
      b.booking_fee_pence,
      b.payment_method ?? '',
      csv(b.payment_note ?? ''),
      b.is_ghost ? 'true' : 'false',
      csv(b.trialist_name ?? ''),
      b.sessions.date,
      b.sessions.start_time,
      b.sessions.end_time,
      csv(b.sessions.coach_name),
      csv(b.children?.name ?? ''),
      csv(b.parents?.name ?? ''),
      csv(b.parents?.email ?? ''),
      csv(b.parents?.phone ?? ''),
      b.stripe_payment_intent_id ?? '',
    ].join(','),
  );

  const body = [header, ...rows].join('\n');
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bookings-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}

function csv(s: string): string {
  if (s == null) return '';
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
