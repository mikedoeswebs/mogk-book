import { SubmitButton } from '@/lib/ui/SubmitButton';
import { sendMagicLink } from './actions';

export function LoginForm() {
  return (
    <form action={sendMagicLink} className="space-y-3">
      <label className="block">
        <span className="block mb-1">Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="w-full"
        />
      </label>
      <SubmitButton pendingLabel="Sending…">Send magic link</SubmitButton>
    </form>
  );
}
