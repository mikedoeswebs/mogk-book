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
      <div className="max-w-2xl space-y-6">
        <Logo size="text-base" />
        <h1 className="text-4xl lg:text-5xl font-bold">
          Goalkeeper coaching, booked in a tap.
        </h1>
        <p className="text-lg text-fg-muted">
          Browse upcoming sessions, book a spot for your player, and manage cancellations and
          credit - all in one place.
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
