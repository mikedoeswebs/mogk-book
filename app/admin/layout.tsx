import { requireAdmin } from '@/lib/auth/require-user';
import { signOut } from '@/app/login/actions';
import { NavLink } from '@/lib/ui/NavLink';
import { BurgerMenu } from '@/lib/ui/BurgerMenu';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();

  return (
    <div>
      <header className="border-b border-b-4 border-accent bg-surface relative">
        <div className="max-w-[1140px] mx-auto px-4">
          {/* Top row: identity + account actions (desktop) or brand + burger (mobile). */}
          <div className="flex flex-wrap items-center gap-4 py-2 md:border-b md:border-line">
            <span className="font-heading uppercase tracking-wide font-bold text-accent">Admin</span>

            {/* Desktop identity cluster. */}
            <span
              className="hidden md:inline ml-auto text-sm text-fg-muted truncate max-w-[260px]"
              title={user.email}
            >
              {user.email}
            </span>
            <NavLink href="/sessions" exact className="hidden md:inline-block! text-xs!">
              Parent view
            </NavLink>
            <form action={signOut} className="hidden md:block">
              <button
                type="submit"
                className="bg-transparent border border-line text-fg hover:bg-surface-2 hover:border-fg-muted text-xs font-normal transition-all"
              >
                Log out
              </button>
            </form>

            {/* Mobile: burger + drawer with all the bits. */}
            <BurgerMenu className="ml-auto">
              <NavLink href="/admin" exact>Dashboard</NavLink>
              <NavLink href="/admin/sessions">Sessions</NavLink>
              <NavLink href="/admin/coaches">Coaches</NavLink>
              <NavLink href="/admin/bookings">Bookings</NavLink>
              <NavLink href="/admin/parents">Parents</NavLink>
              <NavLink href="/admin/approvals">Approvals</NavLink>
              <NavLink href="/admin/analytics">Analytics</NavLink>
              <NavLink href="/admin/import">Import</NavLink>
              <span className="text-sm text-fg-muted pt-2 border-t border-line">{user.email}</span>
              <NavLink href="/sessions" exact>Parent view</NavLink>
              <form action={signOut}>
                <button
                  type="submit"
                  className="bg-transparent border border-line text-fg hover:bg-surface-2 hover:border-fg-muted text-sm font-normal w-full"
                >
                  Log out
                </button>
              </form>
            </BurgerMenu>
          </div>

          {/* Desktop nav row. Hidden on mobile (burger covers it). */}
          <nav className="hidden md:flex flex-wrap gap-x-5 gap-y-2 py-3">
            <NavLink href="/admin" exact>Dashboard</NavLink>
            <NavLink href="/admin/sessions">Sessions</NavLink>
            <NavLink href="/admin/coaches">Coaches</NavLink>
            <NavLink href="/admin/bookings">Bookings</NavLink>
            <NavLink href="/admin/parents">Parents</NavLink>
            <NavLink href="/admin/approvals">Approvals</NavLink>
            <NavLink href="/admin/analytics">Analytics</NavLink>
            <NavLink href="/admin/import">Import</NavLink>
          </nav>
        </div>
      </header>
      <main className="max-w-[1140px] mx-auto p-4 py-6 xl:py-12">{children}</main>
    </div>
  );
}
