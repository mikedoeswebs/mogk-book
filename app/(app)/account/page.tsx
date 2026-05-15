import { requireParent } from '@/lib/auth/require-parent';
import { saveAccount } from './actions';

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const parent = await requireParent();
  const sp = await searchParams;

  return (
    <div className="space-y-4 max-w-md">
      <h1 className="text-2xl font-bold">My account</h1>

      {sp.success && (
        <p className="p-3 bg-[var(--ok-bg)] border border-[var(--ok-line)] text-[var(--ok-fg)] rounded">
          {sp.success}
        </p>
      )}
      {sp.error && (
        <p className="p-3 bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger-fg)] rounded">
          {sp.error}
        </p>
      )}

      <form action={saveAccount} className="space-y-3">
        <label className="block">
          <span className="block mb-1">Your name</span>
          <input
            type="text"
            name="name"
            required
            defaultValue={parent.name}
            className="w-full"
          />
        </label>
        <label className="block">
          <span className="block mb-1">Phone number</span>
          <input
            type="tel"
            name="phone"
            required
            defaultValue={parent.phone ?? ''}
            className="w-full"
          />
        </label>
        <label className="block">
          <span className="block mb-1">Email address</span>
          <input
            type="email"
            name="email"
            required
            defaultValue={parent.email}
            className="w-full"
          />
          <span className="block mt-1 text-xs text-fg-muted">
            Changing your email sends a confirmation link to the new address. You&apos;ll
            keep signing in with the old one until you click that link.
          </span>
        </label>
        <label className="flex items-start gap-2 pt-2 border-t border-line">
          <input
            type="checkbox"
            name="weekly_emails"
            defaultChecked={parent.weekly_emails}
            className="mt-1"
          />
          <span className="text-sm">
            Email me a weekly reminder of upcoming sessions.
          </span>
        </label>
        <button type="submit">Save changes</button>
      </form>
    </div>
  );
}
