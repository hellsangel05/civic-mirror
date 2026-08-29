import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role Supabase client for the ingest pipeline. Ingest runs only on
// a trusted operator machine (never in the browser), so it's OK — and in fact
// necessary — to use the service-role key: measures land as `review_status =
// 'draft'`, and RLS would otherwise hide them from the anon key anyway.

let cached: SupabaseClient | null = null;

export function getIngestSupabaseClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase env missing for ingest: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in apps/ingest/.env.",
    );
  }
  const schema = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public";
  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema },
  }) as SupabaseClient;
  return cached;
}
