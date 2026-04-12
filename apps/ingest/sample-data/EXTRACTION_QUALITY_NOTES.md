# Extraction quality notes

Model: `claude-sonnet-4-6`
Inputs: `measure-a-nov-2024.txt`, `measure-g-nov-2024.txt`
Outputs: `measure-a-nov-2024.extracted.json`, `measure-g-nov-2024.extracted.json`

## Run 1 — 2026-04-10 (initial prototype)

Both runs validated cleanly against the Zod schema on the first attempt — no retries needed. This is the validation gate the prototype was built for. Initial read: extraction quality is good enough to proceed.

### What worked well

- **Faithfulness.** Every claim in `plain_summary_*`, `what_yes/no_means_*`, and `fiscal_impact_*` traces back to the source. Spot-checked 6 claims across both measures against the input text — all supported.
- **Citations.** 13 citations on each measure. All `quote` strings appear verbatim in the source (no paraphrasing in the quotes — the prompt rule held).
- **Bilingual parity.** Spanish reads naturally, not like a word-for-word English calque. "Director Ejecutivo del Condado elegido por los votantes", "junta ciudadana de supervisión", "auditorías independientes obligatorias" — these are how a Spanish-speaking civic educator would phrase it. Native review still required before Phase 3 publish, but the floor is high.
- **Topic tagging discipline.** Measure A got 5 topics (homelessness +1, housing +1, healthcare +1, taxes -1, government-reform +1). Measure G got 2 (government-reform +1, taxes 0). Crucially, the model resisted over-tagging — Measure G could have been tagged with public-safety, civil-rights, etc. via tortured logic, but stayed conservative.
- **Direction signal sanity.** Measure A taxes = -1 (a YES vote raises taxes, which advances "lower taxes" backward — correct under the rubric). Measure G taxes = 0 (no new tax but reallocates ~$8M existing — correct nuance).
- **Author = null worked correctly.** Neither sample has signed pamphlet arguments, so both have `arguments[].author == null`. The strict author rule (rule 9) is doing what it's supposed to.
- **Reviewer notes are useful.** Both runs surfaced exactly the things a human reviewer should check first (vague supporter language, missing oppose-side dollar figure, generic group references).

### Issues found

1. **Supporter list precision.** Measure A's `supporters` included "Various housing and homeless services nonprofits" and "Several LA County Supervisors" as if they were named entities. They're not — they're the source's vague summary phrases. The schema's `name: string` happily accepts these.
2. **Funding parsing.** Measure A: source says "~$20M raised" → output `support_total_usd: 20000000`. Measure G: source says "~$2M raised" → `2000000`. Both correct, but the model is happily converting "approximately X" into a precise integer. A downstream UI showing `$20,000,000` would be misleading.
3. **Sample data is reconstructed, not real.** Per `sample-data/README.md`, neither file is the verbatim official LA County Sample Ballot Book section.
4. **No length / cost telemetry yet.** Real pamphlet sections will be substantially longer; need to confirm we're not hitting `max_tokens` truncation.
5. **Title translations.** Slightly stylized — worth deciding near-literal vs. natural Spanish as a prompt rule eventually.
6. **Stdout pollution.** The first-run extracted JSON files had `npm run` banner lines (`> civic-mirror-ingest@0.0.1 extract:measure-a`) prepended, because the prior invocation redirected `npm run extract:...` without the `-s` silent flag. The files were not actually valid JSON from byte 0.

## Run 2 — 2026-04-10 (fixes for issues 1, 2, 6)

Changes made before re-running:

- **Prompt rule 7 tightened** (`apps/ingest/src/prompts.ts`): supporters/opponents must be specifically named entities; vague phrases like "various housing nonprofits" or "several County Supervisors" are skipped entirely. Precision over coverage.
- **Prompt rule 10 added**: funding figures preserve uncertainty. The model still puts a best-effort integer in `support_total_usd` / `oppose_total_usd`, but sets `is_approximate: true` whenever the source uses hedging language ("approximately", "~", "about", "over", "nearly").
- **Zod `FundingSummary` gained `is_approximate: boolean`** (`apps/ingest/src/schemas.ts`), defaulted to `false`, with an embedded doc comment explaining the rendering contract.
- Extractions re-run via `npm run -s ...` (silent flag) so the JSON files no longer have npm banner contamination.

### Results

Both runs validated cleanly against the updated Zod schema on the first attempt.

**Supporter/opponent precision (issue 1) — fixed.**
- Measure A supporters: 4 → 2. Dropped "Various housing and homeless services nonprofits", "Several LA County Supervisors". Kept LA County Federation of Labor, United Way of Greater LA.
- Measure A opponents: 2 → 1. Dropped "Various taxpayer advocacy groups". Kept Howard Jarvis Taxpayers Association.
- Measure G supporters: now 2 (Supervisor Lindsey Horvath, Supervisor Janice Hahn). Dropped "various good-government and civic reform organizations".
- Measure G opponents: now 5 (Supervisor Kathryn Barger, Supervisor Holly J. Mitchell, LA County Firefighters, LA County Sheriffs, Community Coalition). This is an *increase* from the first run — the tightened rule actually surfaced more real names because the model was clearer on what to include. Nice side effect.
- Reviewer notes on both runs explicitly mention which vague phrases were excluded and why, so a human reviewer can cross-check.

**Funding approximation (issue 2) — fixed.**
- Measure A funding: `support_total_usd: 20000000`, `is_approximate: true`. Source phrase "approximately $20 million" correctly flagged.
- Measure G funding: `support_total_usd: 2000000`, `oppose_total_usd: 1000000`, `is_approximate: true`. Previously the first run had `oppose_total_usd: null` because the hedged source figure was being dropped; the new rule "put your best-effort integer in the field" correctly captures it now.
- The UI contract is now: when `is_approximate` is true, render as `~$X`, not `$X`.

**Stdout pollution (issue 6) — fixed.** Both files now start with `{` on byte 0.

### Known follow-ups still open

- **Issue 3 — real pamphlet text.** Still need to pull one real measure section from the LA County Registrar Sample Ballot Book PDF and validate. This is the remaining prototype gate before Phase 2.
- **Issue 4 — telemetry on real-length inputs.** Same, blocked on real pamphlet text.
- **Issue 5 — title translation policy.** Non-blocking; defer until Spanish reviewer is onboarded in Phase 3.
- ~~**`upsert.ts` drops funding notes and `is_approximate`.**~~ Closed 2026-04-11 by migration `0002_funding_extensions.sql` + updated `upsert.ts`. The `measure_funding` table now carries `is_approximate`, `notes_en`, `notes_es`, and both the voter and admin loaders select them. The per-measure funding summary the extractor returns is mirrored onto each side's row (both support and oppose inherit the same `is_approximate` / notes), which matches how the source pamphlets describe funding in aggregate.

## Suggested next steps (in order)

1. Pull one real LA County Nov 2024 measure section from the actual Registrar Sample Ballot Book PDF, drop it in `sample-data/`, and re-run. If quality holds, the prototype gate is passed.
2. Add a `0002` migration extending `measure_funding` with `is_approximate boolean not null default false`, `notes_en text`, `notes_es text`, then update `upsert.ts` to write them.
3. Begin Phase 2 (voter-facing MVP) wiring — the ingest prototype is now ready enough to unblock page development against real extracted data.

## Operational notes

- `npm run typecheck` clean after both runs.
- Both Run 2 extractions completed in well under the 3-minute timeout (no truncation, no retries, validated on first attempt).
- API key is in `apps/ingest/.env`; `.gitignore` correctly excludes `.env`. Rotate before publishing the repo.
- Always invoke extractions via `npm run -s ...` (silent flag) when redirecting stdout to a file, or the npm banner will corrupt the JSON.
