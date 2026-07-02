import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/auth/require-user';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/sessions';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing-code`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  let destination = next;
  if (next === '/sessions') {
    const { data: { user } } = await supabase.auth.getUser();
    if (isAdminEmail(user?.email)) destination = '/admin';
  }

  return NextResponse.redirect(`${origin}${destination}`);
}
