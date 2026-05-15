import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-user';
import { ArrowLeft } from '@/lib/ui/Icon';
import { createCoach } from './actions';

export default async function NewCoachPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  return (
    <div className="space-y-4">
      <p><Link href="/admin/coaches"><ArrowLeft /> Back to coaches</Link></p>
      <h1 className="text-2xl font-bold">New coach</h1>

      {sp.error && (
        <p className="p-3 bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger-fg)] rounded">
          {sp.error}
        </p>
      )}

      <form action={createCoach} className="space-y-3 max-w-md">
        <label className="block">
          <span className="block mb-1">Name</span>
          <input type="text" name="name" required className="w-full" />
        </label>
        <label className="block">
          <span className="block mb-1">Email (optional)</span>
          <input type="email" name="email" className="w-full" />
        </label>
        <label className="block">
          <span className="block mb-1">Phone (optional)</span>
          <input type="tel" name="phone" className="w-full" />
        </label>
        <label className="block">
          <span className="block mb-1">Notes (optional)</span>
          <textarea name="notes" rows={3} className="w-full" />
        </label>
        <button type="submit">Create coach</button>
      </form>
    </div>
  );
}
