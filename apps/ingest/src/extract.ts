import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { ExtractedMeasure } from "./schemas.ts";
import { SYSTEM_PROMPT, userMessageFor } from "./prompts.ts";
import { getIngestSupabaseClient } from "./supabase.ts";
import { ensureElection, upsertMeasure, type ElectionRef } from "./upsert.ts";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 8192;

// All measures we extract right now belong to the same election. When we
// add a second election we'll either pass this in as a CLI flag or infer it
// from the source file path.
const DEFAULT_ELECTION: ElectionRef = {
  jurisdiction: "la-ca",
  election_date: "2024-11-05",
  type: "general",
  label_en: "Los Angeles County — November 2024 General Election",
  label_es: "Condado de Los Ángeles — Elección general de noviembre de 2024",
};

// Minimal .env loader — keeps this package dependency-free. Looks for `.env`
// in the current working directory. Lines starting with `#` are comments;
// blank lines are skipped; values are not unquoted or interpolated. Existing
// non-empty process.env entries win; empty-string entries are treated as
// unset (this matters because some shells inherit blank vars from the
// parent environment and we want the .env value in that case).
function loadDotenv(): void {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!key) continue;
    const existing = process.env[key];
    if (existing === undefined || existing === "") process.env[key] = value;
  }
}

interface CliArgs {
  sourcePath: string;
  sourceText: string;
  write: boolean;
}

function parseCli(): CliArgs {
  const positional: string[] = [];
  let write = false;
  for (const arg of process.argv.slice(2)) {
    if (arg === "--write") write = true;
    else if (arg.startsWith("--")) {
      console.error(`unknown flag: ${arg}`);
      process.exit(2);
    } else {
      positional.push(arg);
    }
  }
  const src = positional[0];
  if (!src) {
    console.error(
      "usage: tsx src/extract.ts <path-to-source.txt> [--write]\n" +
        "       npm run extract:measure-a\n" +
        "       npm run extract:measure-g\n" +
        "\n" +
        "  --write   upsert the result into Supabase as review_status=draft\n" +
        "            (default: print JSON to stdout, don't touch the DB)",
    );
    process.exit(2);
  }
  const sourcePath = resolve(process.cwd(), src);
  const sourceText = readFileSync(sourcePath, "utf8").trim();
  if (!sourceText) {
    console.error(`source file is empty: ${sourcePath}`);
    process.exit(2);
  }
  return { sourcePath, sourceText, write };
}

function loadEnv(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error(
      "ANTHROPIC_API_KEY is not set.\n" +
        "Copy .env.example to .env and fill in your key, or export it in your shell.",
    );
    process.exit(2);
  }
  return key;
}

// Claude is instructed to return a bare JSON object. If it wraps the JSON in
// a code fence despite that, unwrap it. Anything else is an error the human
// should see so we can tighten the prompt.
function parseJsonResponse(raw: string): unknown {
  const trimmed = raw.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(unfenced);
  } catch (err) {
    throw new Error(
      `Model response was not valid JSON. First 400 chars:\n${trimmed.slice(0, 400)}\n\nParse error: ${(err as Error).message}`,
    );
  }
}

async function main() {
  loadDotenv();
  const { sourcePath, sourceText, write } = parseCli();
  const apiKey = loadEnv();

  console.error(`[ingest] extracting: ${sourcePath}`);
  console.error(`[ingest] model:      ${MODEL}`);
  console.error(`[ingest] source len: ${sourceText.length} chars`);
  console.error(`[ingest] write mode: ${write ? "ON (will upsert to Supabase)" : "OFF (dry run)"}`);

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessageFor(sourceText) }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Model response had no text block.");
  }

  const parsed = parseJsonResponse(textBlock.text);
  const validated = ExtractedMeasure.safeParse(parsed);
  if (!validated.success) {
    console.error("[ingest] schema validation FAILED:");
    console.error(validated.error.format());
    console.error("\n[ingest] raw model JSON was:");
    console.error(JSON.stringify(parsed, null, 2));
    process.exit(1);
  }

  const m = validated.data;

  if (!write) {
    console.log(JSON.stringify(m, null, 2));
  }

  console.error("");
  console.error(`[ingest] ok — ${m.code}: ${m.title_en}`);
  console.error(`[ingest] citations:       ${m.source_citations.length}`);
  console.error(`[ingest] arguments:       ${m.arguments.length}`);
  console.error(`[ingest] impacts tagged:  ${m.impacts.length}`);
  console.error(`[ingest] supporters:      ${m.supporters.length}`);
  console.error(`[ingest] opponents:       ${m.opponents.length}`);
  if (m.reviewer_notes_en) {
    console.error(`[ingest] reviewer notes: ${m.reviewer_notes_en}`);
  }

  if (write) {
    const supabase = getIngestSupabaseClient();
    const electionId = await ensureElection(supabase, DEFAULT_ELECTION);
    const result = await upsertMeasure(supabase, electionId, m, null);
    console.error("");
    console.error(`[ingest] supabase: election ${electionId}`);
    console.error(`[ingest] supabase: measure  ${result.measureId} (${result.action})`);
    console.error(
      `[ingest] supabase: children — args ${result.counts.arguments}, impacts ${result.counts.impacts}, sup ${result.counts.supporters}, opp ${result.counts.opponents}, funding ${result.counts.funding}`,
    );
    console.error("[ingest] review_status remains 'draft' until a human publishes it.");
  }
}

main().catch((err) => {
  console.error("[ingest] FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
