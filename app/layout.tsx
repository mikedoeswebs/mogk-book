import Link from 'next/link';
import type { Metadata } from 'next';
import { Montserrat, Noto_Sans } from 'next/font/google';
import { Logo } from '@/lib/ui/Logo';
import { NavProgress } from '@/lib/ui/NavProgress';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-montserrat',
  display: 'swap',
});

const notoSans = Noto_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MO Goalkeeping - Bookings',
  description: 'Book goalkeeper coaching sessions for your player.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`h-full ${montserrat.variable} ${notoSans.variable}`}>
      <body className="min-h-full flex flex-col">
        <NavProgress />
        <div className="flex-1">{children}</div>
        <footer className="border-t border-line bg-surface mt-12">
          <div className="max-w-[1140px] mx-auto p-4 flex flex-col md:flex-row flex-wrap gap-4 items-center text-sm text-fg-muted">
            <span className="flex items-baseline gap-2">
              <Logo size="text-sm" />
              <span>© {new Date().getFullYear()}</span>
            </span>
            <nav className="flex flex-wrap gap-4 ml-auto">
              <Link href="/legal/terms" className="text-fg! hover:text-accent! no-underline! hover:no-underline!">Terms</Link>
              <Link href="/legal/privacy" className="text-fg! hover:text-accent! no-underline! hover:no-underline!">Privacy &amp; cookies</Link>
              <Link href="/legal/payments" className="text-fg! hover:text-accent! no-underline! hover:no-underline!">Payment FAQs</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
