# Supabase

Schema migrations and notes for the Civic Mirror Supabase project.

## Applying migrations

Migrations are numbered SQL files in `migrations/`. Run them in order against a fresh Supabase project:

```bash
# via the Supabase CLI
supabase db push

# or paste directly into the SQL editor in the Supabase dashboard during Phase 0
# while we're still iterating on the schema before the pipeline is live
```

## Current migrations

- `0001_initial_schema.sql` — replaces the old `candidate_issues` prototype table. Creates the full Layer 2–centric schema: `topics`, `elections`, `measures`, `measure_arguments`, `measure_impacts`, `measure_endorsements`, `measure_funding`, `races`, `candidates`, `voter_sessions`, `ballot_shares`. Seeds the 12-topic taxonomy. Turns on RLS everywhere and only exposes `review_status = 'published'` measures to the public anon key.

## Conventions

- **Every plain-language content field has EN and ES columns.** Spanish is a peer, not a translation afterthought.
- **`review_status` gates publication.** Rows from the LLM pipeline land as `'draft'`. A human flips them to `'published'`. RLS refuses to serve drafts via the anon key.
- **Service-role client bypasses RLS.** Only used server-side in `apps/web/src/lib/supabase/server.ts` and in ingest scripts. Never import it into a client component.
- **Topics are a closed set.** Keep `supabase/migrations/0001_initial_schema.sql` seed list, `apps/web/src/lib/topics.ts`, and `apps/ingest/src/topics.ts` in sync. If they drift, alignment scoring breaks.
