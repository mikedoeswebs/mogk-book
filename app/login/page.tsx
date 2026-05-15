import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/require-user';
import { Logo } from '@/lib/ui/Logo';
import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect('/sessions');

  const params = await searchParams;

  return (
    <main className="max-w-md mx-auto p-6 py-12 space-y-4">
      <Logo size="text-sm" />
      <h1 className="text-3xl font-bold">Log in</h1>
      <p className="text-fg-muted">
        Enter your email and we&apos;ll send you a one-tap link to log in. No password needed.
      </p>
      {params.sent && (
        <p className="p-3 bg-[var(--ok-bg)] border border-[var(--ok-line)] text-[var(--ok-fg)] rounded">
          Check your inbox - the magic link has been sent. It expires in an hour.
        </p>
      )}
      {params.error && (
        <p className="p-3 bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger-fg)] rounded">
          Something went wrong: {params.error}
        </p>
      )}
      <LoginForm />
    </main>
  );
}
