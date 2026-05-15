import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/require-user';
import { Logo } from '@/lib/ui/Logo';
import { ArrowRight } from '@/lib/ui/Icon';

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect('/sessions');

  return (
    <main className="max-w-[1140px] mx-auto px-6 py-16 lg:py-24">
      <div className="space-y-6">
        <Logo size="text-base" />
        <h1>
          <span className="block font-black mb-2 text-4xl lg:text-5xl xl:text-6xl">Club <span className="text-accent">MO/GK</span></span>
          <span className="text-xl lg:text-2xl font-bold">Online Booking System</span>
        </h1>
        <p className="text-lg text-fg-muted">
          Browse our sessions, book your spot and manage your bookings - all in one place.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/login"
            className="inline-block bg-accent text-accent-ink font-semibold no-underline px-5 py-3 rounded hover:bg-accent-hover"
          >
            Log in or register <ArrowRight />
          </Link>
        </div>
      </div>
    </main>
  );
}
