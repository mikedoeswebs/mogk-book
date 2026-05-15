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
 * `/admin/sessions`).
 */
export function NavLink({
  href,
  children,
  exact = false,
  className = '',
}: {
  href: string;
  children: ReactNode;
  exact?: boolean;
  className?: string;
}) {
  const pathname = usePathname();
  const isActive = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(href + '/');

  return (
    <Link
      href={href}
      className={
        'font-heading uppercase font-bold tracking-wide text-sm no-underline! hover:no-underline! transition-all ' +
        (isActive ? 'text-accent! ' : 'text-fg! hover:text-accent! ') +
        className
      }
      aria-current={isActive ? 'page' : undefined}
    >
      {children}
    </Link>
  );
}
