'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Nav link with active-state styling.
 *
 * - white, Montserrat, bold, uppercase, slight letter-spacing
 * - lime on hover and when the route is active
 * - no underline in any state
 *
 * Pass `exact` for routes that should only light up on themselves (e.g. the
 * admin Dashboard at `/admin` shouldn't stay active when you're on
 * `/admin/sessions`). Pass `match` when one link stands for several routes
 * (e.g. People covers parents, players and coaches).
 */
export function NavLink({
  href,
  children,
  exact = false,
  match = [href],
  className = '',
}: {
  href: string;
  children: ReactNode;
  exact?: boolean;
  match?: string[];
  className?: string;
}) {
  const pathname = usePathname();
  const isActive = exact
    ? pathname === href
    : match.some((m) => pathname === m || pathname.startsWith(m + '/'));

  return (
    <Link
      href={href}
      className={
        'font-heading uppercase font-bold tracking-wide text-sm no-underline! hover:no-underline! transition-all active:opacity-70 active:scale-[0.98] ' +
        (isActive
          ? 'text-accent! '
          : 'text-fg! hover:text-accent! active:text-accent! ') +
        className
      }
      aria-current={isActive ? 'page' : undefined}
    >
      {children}
    </Link>
  );
}
