import { requireAdmin } from '@/lib/auth/require-user';
import { signOut } from '@/app/login/actions';
import { NavLink } from '@/lib/ui/NavLink';
import { BurgerMenu } from '@/lib/ui/BurgerMenu';
import Link from 'next/link';
import { Logo } from '@/lib/ui/Logo';
import { SubmitButton } from '@/lib/ui/SubmitButton';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const { count: pendingApprovals } = await createSupabaseAdminClient()
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'awaiting_approval');

  // One list for both the desktop row and the mobile drawer. The logo links
  // to the dashboard, so it doesn't need its own item.
  const nav = (
    <>
      <NavLink href="/admin/sessions">Sessions</NavLink>
      <NavLink href="/admin/bookings" match={['/admin/bookings', '/admin/approvals']}>
        Bookings
        {Boolean(pendingApprovals) && (
          <span
            className="ml-1.5 inline-block min-w-5 px-1.5 rounded-full bg-accent text-accent-ink text-xs text-center"
            title={`${pendingApprovals} awaiting approval`}
          >
            {pendingApprovals}
          </span>
        )}
      </NavLink>
      <NavLink href="/admin/parents" match={['/admin/parents', '/admin/players', '/admin/coaches']}>
        People
      </NavLink>
      <NavLink href="/admin/analytics" match={['/admin/analytics', '/admin/income']}>
        Reports
      </NavLink>
    </>
  );

  return (
    <div>
      <header className="border-b border-line bg-surface">
        <div className="max-w-[1140px] mx-auto px-4">
          {/* Top row: identity + account actions (desktop) or brand + burger (mobile). */}
          <div className="flex flex-wrap items-center gap-4 py-2 md:border-b md:border-line">
            <Link href="/admin" className="no-underline text-fg hover:text-accent">
              <Logo size="text-lg" />
              <span className="font-heading uppercase tracking-wide font-normal text-lg text-line mx-3">|</span>
              <span className="font-heading uppercase tracking-wide font-normal text-lg text-accent ml-1">Admin</span>
            </Link>

            {/* Desktop identity cluster. */}
            <Link
              href="/account"
              className="hidden md:inline ml-auto text-sm text-white hover:text-accent font-heading font-bold no-underline uppercase transition-all"
              title="My account"
            >
              My Account
            </Link>
            <NavLink href="/sessions" exact className="hidden md:inline-block! text-sm">
              Parent view
            </NavLink>
            <form action={signOut} className="hidden md:block">
              <SubmitButton
                className="bg-transparent text-fg-muted hover:text-accent font-bold block text-sm p-0 border-0 transition-all"
              >
                Log out
              </SubmitButton>
            </form>

            {/* Mobile: burger + drawer with all the bits. */}
            <BurgerMenu className="ml-auto">
              {nav}
              <span className="text-sm text-fg-muted pt-2 border-t border-line">{user.email}</span>
              <NavLink href="/sessions" exact>Parent view</NavLink>
              <form action={signOut}>
                <SubmitButton
                  className="bg-transparent border border-line text-fg hover:bg-surface-2 hover:border-fg-muted text-sm font-normal w-full"
                >
                  Log out
                </SubmitButton>
              </form>
            </BurgerMenu>
          </div>

          {/* Desktop nav row. Hidden on mobile (burger covers it). */}
          <nav className="hidden md:flex flex-wrap gap-x-5 gap-y-2 py-3">
            {nav}
          </nav>
        </div>
      </header>
      <main className="max-w-[1140px] mx-auto p-4 py-6 xl:py-12">{children}</main>
    </div>
  );
}
