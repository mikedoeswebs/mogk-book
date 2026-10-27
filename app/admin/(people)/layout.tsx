import { NavLink } from '@/lib/ui/NavLink';

export default function PeopleLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav aria-label="People" className="flex flex-wrap gap-x-5 gap-y-2 pb-3 mb-6 border-b border-line">
        <NavLink href="/admin/parents">Parents</NavLink>
        <NavLink href="/admin/players">Players</NavLink>
        <NavLink href="/admin/coaches">Coaches</NavLink>
      </nav>
      {children}
    </>
  );
}
