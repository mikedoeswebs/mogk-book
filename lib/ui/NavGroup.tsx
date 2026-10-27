import type { ReactNode } from 'react';
import { NavLink } from './NavLink';

type Item = { href: string; label: ReactNode };

/**
 * Top-level nav item with sub-links. On desktop the sub-links drop down on
 * hover or keyboard focus (CSS only, so the parent stays a plain link and
 * works without JS). In the mobile drawer they sit indented underneath.
 *
 * The parent lights up for any of its items' routes.
 */
export function NavGroup({ label, items }: { label: ReactNode; items: Item[] }) {
  return (
    <div className="group relative">
      <NavLink href={items[0].href} match={items.map((i) => i.href)}>
        {label}
      </NavLink>
      <div className="flex flex-col gap-2 pl-4 pt-2 md:hidden md:absolute md:left-0 md:top-full md:z-20 md:pl-0 md:group-hover:block md:group-focus-within:block">
        <ul className="md:min-w-44 md:py-2 md:bg-surface md:border md:border-line md:rounded md:shadow-lg flex flex-col gap-2 md:gap-0">
          {items.map((i) => (
            <li key={i.href}>
              <NavLink href={i.href} className="md:block md:px-4 md:py-1.5 md:hover:bg-surface-2">
                {i.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
