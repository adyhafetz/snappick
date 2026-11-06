import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Supabase client for Route Handlers that acts as the signed-in admin (cookie session),
 * so Row Level Security applies exactly as it does in the browser. A plain anon client
 * on the server sees nothing in RLS-protected tables.
 */
export async function getServerSupabase(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Route Handlers here only read the session; the middleware refreshes cookies.
        },
      },
    }
  );
}

/** Returns the admin-scoped client, or a ready-made 401/403 response. Defence in depth behind the middleware. */
export async function requireAdmin(): Promise<
  { supabase: SupabaseClient; response?: undefined } | { supabase?: undefined; response: NextResponse }
> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { response: NextResponse.json({ error: 'Sign in required' }, { status: 401 }) };
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile?.is_admin) {
    return { response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }
  return { supabase };
}
