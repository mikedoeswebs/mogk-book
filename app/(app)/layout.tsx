import Link from 'next/link';
import { requireParent } from '@/lib/auth/require-parent';
import { isAdminEmail } from '@/lib/auth/require-user';
import { signOut } from '@/app/login/actions';
import { getSelection } from '@/lib/booking/selection';
import { clearAllSelection } from '@/app/(app)/sessions/selection-actions';
import { Logo } from '@/lib/ui/Logo';
import { NavLink } from '@/lib/ui/NavLink';
import { BurgerMenu } from '@/lib/ui/BurgerMenu';
import { ArrowRight } from '@/lib/ui/Icon';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const parent = await requireParent();
  const admin = isAdminEmail(parent.email);
  const selection = await getSelection();
  const selectionCount = selection.items.length;
  const missingChild = selection.items.filter((i) => !i.childId).length;

  return (
    <div>
      <header className="border-b border-line bg-surface">
        <nav className="max-w-[1140px] mx-auto p-4 flex flex-wrap gap-4 items-center">
          <Link href="/sessions" className="no-underline text-fg hover:text-accent">
            <Logo size="text-lg" />
          </Link>

          {/* Desktop: divider + inline nav + identity. */}
          <span className="hidden md:inline text-line">|</span>
          <NavLink href="/sessions" className="hidden md:inline-block!">Sessions</NavLink>
          <NavLink href="/bookings" className="hidden md:inline-block!">My bookings</NavLink>
          <NavLink href="/children" className="hidden md:inline-block!">My players</NavLink>
          <span className="hidden md:inline ml-auto text-sm text-fg-muted truncate max-w-[260px]" title={parent.email}>
            {parent.email}
          </span>
          {admin && (
            <NavLink href="/admin" className="hidden md:inline-block! text-xs!">Admin</NavLink>
          )}
          <form action={signOut} className="hidden md:block">
            <button
              type="submit"
              className="bg-transparent border border-line text-fg hover:bg-surface-2 hover:border-fg-muted text-sm font-normal"
            >
              Log out
            </button>
          </form>

          {/* Mobile: burger toggle + drawer. */}
          <BurgerMenu className="ml-auto">
            <NavLink href="/sessions">Sessions</NavLink>
            <NavLink href="/bookings">My bookings</NavLink>
            <NavLink href="/children">My players</NavLink>
            <span className="text-sm text-fg-muted pt-2 border-t border-line">{parent.email}</span>
            {admin && <NavLink href="/admin">Admin</NavLink>}
            <form action={signOut}>
              <button
                type="submit"
                className="bg-transparent border border-line text-fg hover:bg-surface-2 hover:border-fg-muted text-xs font-normal w-full transition-all"
              >
                Log out
              </button>
            </form>
          </BurgerMenu>
        </nav>
      </header>

      {selectionCount > 0 && (
        <div
          className="
            bg-surface-2 border-line
            fixed inset-x-0 bottom-0 z-40 border-t shadow-[0_-2px_10px_rgba(0,0,0,0.35)]
            md:static md:border-t-0 md:border-b md:shadow-none md:z-auto
          "
        >
          <div
            className="
              max-w-[1140px] mx-auto px-4 py-2.5 md:py-2
              pb-[max(0.625rem,env(safe-area-inset-bottom))] md:pb-2
              flex flex-wrap items-center gap-3 text-sm
            "
          >
            <div className="flex-1 min-w-full md:min-w-0">
              <p className="text-fg leading-tight">
                <strong>{selectionCount}</strong> session{selectionCount === 1 ? '' : 's'} selected
              </p>
              {missingChild > 0 && (
                <p className="text-xs text-fg-muted leading-tight mt-0.5">
                  {missingChild} need{missingChild === 1 ? 's' : ''} a player assigned
                </p>
              )}
            </div>
            <form action={clearAllSelection}>
              <button
                type="submit"
                className="bg-transparent border border-fg-muted text-fg-muted hover:text-fg px-4 md:px-3 py-2 text-xs transition-all"
                aria-label="Clear selection"
              >
                Clear
              </button>
            </form>
            <Link
              href="/book"
              className="bg-accent text-accent-ink no-underline border border-accent hover:bg-accent-hover font-bold font-heading px-3 py-2 uppercase rounded text-xs whitespace-nowrap flex-1 md:flex-0 text-center"
            >
              Review &amp; pay <ArrowRight />
            </Link>
          </div>
        </div>
      )}

      <main
        className={`max-w-[1140px] mx-auto p-4 py-8 xl:py-12${
          selectionCount > 0 ? ' md:pb-8 xl:pb-12' : ''
        }`}
      >
        {children}
      </main>
    </div>
  );
}
