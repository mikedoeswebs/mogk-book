'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Mobile-only collapsible nav drawer. The button shows below the `md`
 * breakpoint (≈768px); above that the burger and the drawer are both hidden
 * via Tailwind's responsive utilities — the layout's inline desktop nav
 * takes over.
 *
 * Auto-closes whenever the route changes (a tap on a NavLink doesn't leave
 * the drawer hanging open). We derive `open` from a stored pathname rather
 * than syncing via useEffect, which keeps the React-hooks purity rule happy.
 */
export function BurgerMenu({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenedAt(open ? null : pathname)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        className={
          `md:hidden bg-transparent border border-line text-fg hover:bg-surface-2 ` +
          `inline-flex items-center justify-center w-10 h-10 p-0 font-normal text-lg ` +
          className
        }
      >
        {open ? '✕' : '☰'}
      </button>
      {open && (
        <div className="md:hidden basis-full mt-3 pt-3 border-t border-line flex flex-col gap-3">
          {children}
        </div>
      )}
    </>
  );
}
