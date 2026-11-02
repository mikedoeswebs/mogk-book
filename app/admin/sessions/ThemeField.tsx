import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Free-text theme with suggestions from every theme used before, so the same
 * theme is spelled the same way each time it comes round.
 */
export async function ThemeField({ value }: { value: string | null }) {
  const { data } = await createSupabaseAdminClient()
    .from('sessions')
    .select('theme')
    .not('theme', 'is', null)
    .returns<{ theme: string }[]>();
  const themes = [...new Set((data ?? []).map((r) => r.theme))].sort((a, b) => a.localeCompare(b));

  return (
    <label className="block">
      <span className="block mb-1">Theme (shown to parents)</span>
      <input
        type="text"
        name="theme"
        list="session-themes"
        defaultValue={value ?? ''}
        placeholder="e.g. Shot stopping"
        className="w-full"
      />
      <datalist id="session-themes">
        {themes.map((t) => <option key={t} value={t} />)}
      </datalist>
    </label>
  );
}
