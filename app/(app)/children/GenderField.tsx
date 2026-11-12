import type { PlayerGender } from '@/lib/db/types';

/** No default on a new player, so the parent always makes the choice. */
export function GenderField({ value }: { value?: PlayerGender }) {
  return (
    <label className="block">
      <span className="block mb-1">Boy or girl</span>
      <select name="gender" required defaultValue={value ?? ''} className="w-full">
        <option value="" disabled>Choose…</option>
        <option value="male">Boy</option>
        <option value="female">Girl</option>
      </select>
      <span className="block text-sm text-fg-muted mt-1">
        Choose whichever best describes your child. We only use this to show which sessions they
        can book, as some sessions are for girls only.
      </span>
    </label>
  );
}
