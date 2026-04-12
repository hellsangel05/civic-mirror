import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-side Supabase client. Uses the service-role key so server code can
// read and write any row — this client must NEVER be imported into a client
// component or exposed via a route handler that leaks its results unfiltered.
// The anon-key client below is the one client-facing code should use.

let cachedServiceClient: SupabaseClient | null = null;

export function getSupabaseServiceClient(): SupabaseClient {
  if (cachedServiceClient) return cachedServiceClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase server env missing: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  cachedServiceClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedServiceClient;
}
