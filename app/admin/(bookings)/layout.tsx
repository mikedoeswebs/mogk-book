import { NavLink } from '@/lib/ui/NavLink';

export default function BookingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav aria-label="Bookings" className="flex flex-wrap gap-x-5 gap-y-2 pb-3 mb-6 border-b border-line">
        <NavLink href="/admin/bookings">All bookings</NavLink>
        <NavLink href="/admin/approvals">Approvals</NavLink>
      </nav>
      {children}
    </>
  );
}
