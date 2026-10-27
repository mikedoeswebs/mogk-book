import { NavLink } from '@/lib/ui/NavLink';

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav aria-label="Reports" className="flex flex-wrap gap-x-5 gap-y-2 pb-3 mb-6 border-b border-line">
        <NavLink href="/admin/analytics">Analytics</NavLink>
        <NavLink href="/admin/income">Income</NavLink>
      </nav>
      {children}
    </>
  );
}
