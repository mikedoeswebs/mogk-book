import { requireAdmin } from '@/lib/auth/require-user';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Coach } from '@/lib/db/types';
import { ImportClient } from './ImportClient';
import { CoachAssignmentsClient } from './CoachAssignmentsClient';

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    success?: string;
    sessions?: string;
    bookings?: string;
    awards?: string;
    skipped?: string;
    coach_success?: string;
    coach_rows?: string;
    coach_created?: string;
    coach_dates?: string;
    coach_links?: string;
    coach_skipped?: string;
  }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const supabase = createSupabaseAdminClient();
  const { data: coaches } = await supabase
    .from('coaches')
    .select('*')
    .eq('active', true)
    .order('name', { ascending: true })
    .returns<Coach[]>();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Historic data import</h1>

      {sp.error && (
        <p className="p-3 bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger-fg)] rounded">
          {sp.error}
        </p>
      )}

      {sp.success && (
        <p className="p-3 bg-[var(--ok-bg)] border border-[var(--ok-line)] text-[var(--ok-fg)] rounded">
          Player import complete. Sessions created: <strong>{sp.sessions}</strong>. Bookings created:{' '}
          <strong>{sp.bookings}</strong>. Awards set: <strong>{sp.awards}</strong>. Rows skipped:{' '}
          <strong>{sp.skipped}</strong>.
        </p>
      )}

      {sp.coach_success && (
        <p className="p-3 bg-[var(--ok-bg)] border border-[var(--ok-line)] text-[var(--ok-fg)] rounded">
          Coach assignments imported. Rows processed: <strong>{sp.coach_rows}</strong>. New coaches:{' '}
          <strong>{sp.coach_created}</strong>. Dates updated: <strong>{sp.coach_dates}</strong>. Links set:{' '}
          <strong>{sp.coach_links}</strong>. Skipped: <strong>{sp.coach_skipped}</strong>.
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Player attendance &amp; awards</h2>
        <p className="text-fg-muted text-sm max-w-2xl">
          Upload the player-attendance CSV (long-form columns: <code className="text-fg">date,player_name,group,status,captain,potw</code>).
          Each row becomes a ghost booking against a session created on the fly. Re-running the
          same import is safe - sessions and bookings dedupe on their natural keys.
        </p>
        <ImportClient coaches={coaches ?? []} />
      </section>

      <section className="space-y-3 border-t border-line pt-6">
        <h2 className="text-xl font-bold">Coach assignments</h2>
        <p className="text-fg-muted text-sm max-w-2xl">
          Upload the coach-assignment CSV (columns: <code className="text-fg">date,coach_name</code>).
          For every date in the file, the listed coaches replace the existing coach roster on all
          sessions for that date - useful once historic sessions have been imported and you want
          per-week coach lists set correctly.
        </p>
        <CoachAssignmentsClient />
      </section>
    </div>
  );
}
