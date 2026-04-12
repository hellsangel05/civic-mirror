import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser / client-component Supabase client. Uses the public anon key, which
// is safe to ship to the browser because Row Level Security policies on each
// table are what actually gate access. Every table in the migration has RLS
// enabled — if you add a new table, enable RLS on it before reading from it
// in the browser.

let cachedBrowserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (cachedBrowserClient) return cachedBrowserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase browser env missing: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  cachedBrowserClient = createClient(url, anonKey);
  return cachedBrowserClient;
}
