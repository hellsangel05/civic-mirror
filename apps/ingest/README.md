# civic-mirror-ingest

Prototype ingestion pipeline for Civic Mirror. Reads a ballot measure's raw voter-pamphlet text and uses Claude to produce a structured, bilingual (EN + ES), citation-backed summary suitable for the voter-facing app.

This is **Phase 1, scoped to option (c)**: validate that Claude can reliably produce high-quality extraction from real LA County voter pamphlet content **before** committing to the full rearchitecture.

## What it does (today)

1. Reads a `.txt` file containing one measure's pamphlet text (ballot question, impartial analysis, fiscal impact, arguments, etc.).
2. Sends it to Claude (`claude-sonnet-4-6`) with a strict extraction prompt.
3. Validates the response against a Zod schema (`src/schemas.ts`).
4. Prints structured JSON to stdout.

What it intentionally does *not* do yet: fetch PDFs, parse PDF to text, hit Supabase, run an admin review UI. Those come after we're convinced the extraction quality is good.

## Setup

```bash
cd apps/ingest
cp .env.example .env
# edit .env and add your Anthropic API key
npm install
```

## Run

Against one of the sample measures:

```bash
npm run extract:measure-a
npm run extract:measure-g
```

Against an arbitrary file:

```bash
npm run extract -- path/to/measure.txt
```

## Validating quality

Things to check on every extracted measure:

- **Faithfulness**: every claim in `plain_summary_en` / `plain_summary_es` should be supported by the source text, and the `source_citations` array should name the specific phrases it came from.
- **Reading level**: aim for 8th grade or below on both languages.
- **Spanish parity**: the Spanish summary should not read like a mechanical translation of the English — both should be written from the source text as peers. Native-speaker review is required before we ever publish.
- **YES/NO clarity**: `what_yes_means_*` and `what_no_means_*` should be unambiguous action-outcome sentences. Avoid legalese.
- **Topic tagging sanity**: `impacts[].direction` should actually match how a real policy advocate on that topic would vote.
- **No hallucinated supporters/opponents**: if the source lists them, include them; if it doesn't, leave the arrays empty — do not invent.

## Sample data

See `sample-data/README.md`. The files there are reconstructed representative inputs, not the verbatim official pamphlet. Replace with real LA County Registrar PDFs before Phase 1 ships.
