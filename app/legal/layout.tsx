import Link from 'next/link';
import { Logo } from '@/lib/ui/Logo';
import { NavLink } from '@/lib/ui/NavLink';
import { BurgerMenu } from '@/lib/ui/BurgerMenu';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header className="border-b border-line bg-surface">
        <div className="max-w-[1140px] mx-auto p-4 flex flex-wrap items-center gap-4">
          <Link href="/" className="no-underline text-fg hover:text-accent">
            <Logo size="text-lg" />
          </Link>

          {/* Desktop nav. */}
          <nav className="hidden md:flex gap-4 ml-auto">
            <NavLink href="/legal/terms">Terms</NavLink>
            <NavLink href="/legal/privacy">Privacy &amp; cookies</NavLink>
            <NavLink href="/legal/payments">Payment FAQs</NavLink>
          </nav>

          {/* Mobile burger. */}
          <BurgerMenu className="ml-auto">
            <NavLink href="/legal/terms">Terms</NavLink>
            <NavLink href="/legal/privacy">Privacy &amp; cookies</NavLink>
            <NavLink href="/legal/payments">Payment FAQs</NavLink>
          </BurgerMenu>
        </div>
      </header>
      <main className="max-w-[720px] mx-auto p-6 space-y-4 leading-relaxed">
        {children}
      </main>
    </div>
  );
}
