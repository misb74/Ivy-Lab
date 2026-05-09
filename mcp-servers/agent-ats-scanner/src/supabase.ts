import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.ATS_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.ATS_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.ATS_SUPABASE_SERVICE_KEY ||
    process.env.ATS_SUPABASE_PUBLISHABLE_KEY ||
    process.env.ATS_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing ATS_SUPABASE_URL/SUPABASE_URL and Supabase service/anon key environment variables');
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export function hasServiceRoleKey(): boolean {
  return Boolean(
    process.env.ATS_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.ATS_SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY,
  );
}
