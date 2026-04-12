import { z } from "zod";
import { TOPIC_SLUGS } from "./topics.ts";

// A verbatim snippet from the source text that supports a particular claim
// in the extracted summary. Every non-trivial output field must be backed
// by at least one of these so a reviewer (and the user) can trace where
// each statement came from.
export const SourceCitation = z.object({
  claim: z.string().min(1).describe(
    "A short description of what this citation is supporting (e.g., 'fiscal impact estimate', 'what a yes vote does').",
  ),
  quote: z.string().min(1).describe(
    "The exact, verbatim phrase from the source text that supports the claim. Do not paraphrase.",
  ),
});
export type SourceCitation = z.infer<typeof SourceCitation>;

// One pro/con argument block. Mirrors the `measure_arguments` table.
export const MeasureArgument = z.object({
  side: z.enum(["pro", "con"]),
  summary_en: z.string().min(1),
  summary_es: z.string().min(1),
  author: z.string().nullable().describe(
    "ONLY the individual(s) who literally signed the 'Argument in Favor' or 'Argument Against' in the voter pamphlet. Not the broader list of endorsing organizations or supporters. If the source does not specifically attribute the argument to named signers, this must be null.",
  ),
});
export type MeasureArgument = z.infer<typeof MeasureArgument>;

// Topic-level impact tag. direction is from the perspective of someone who
// cares about *advancing* the topic: +1 means "a YES vote moves this topic
// forward", -1 means "a YES vote moves this topic backward", 0 means mixed
// or neutral. The user quiz asks only about topic importance, so this
// `direction` + `confidence` is what drives the alignment score later.
export const MeasureImpact = z.object({
  topic: z.enum(TOPIC_SLUGS),
  direction: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  confidence: z.number().int().min(0).max(100),
  rationale_en: z.string().min(1),
  rationale_es: z.string().min(1),
});
export type MeasureImpact = z.infer<typeof MeasureImpact>;

// Named supporter or opponent organization (or person) exactly as the
// source lists them. Do not invent. Leave the lists empty if the source
// doesn't name any.
export const NamedParty = z.object({
  name: z.string().min(1),
  role: z.enum(["support", "oppose"]),
});
export type NamedParty = z.infer<typeof NamedParty>;

// Rough funding summary. All fields nullable because the source may not
// include any campaign finance information at all.
//
// is_approximate is true whenever the source describes dollar figures with
// hedging language like "approximately", "about", "~", "roughly", "over",
// "nearly". In that case the model still puts its best-effort integer in
// support_total_usd / oppose_total_usd, but the UI is expected to render
// it as "~$X" rather than "$X". Rule 10 in the prompt enforces this.
export const FundingSummary = z.object({
  support_total_usd: z.number().nonnegative().nullable(),
  oppose_total_usd: z.number().nonnegative().nullable(),
  is_approximate: z.boolean().default(false),
  notes_en: z.string().nullable(),
  notes_es: z.string().nullable(),
});
export type FundingSummary = z.infer<typeof FundingSummary>;

// The full extracted measure. One of these per measure per election.
export const ExtractedMeasure = z.object({
  code: z.string().min(1).describe(
    "The measure's short code EXACTLY as it appears on the ballot — e.g. 'Measure A', 'Measure G', 'Proposition 36'. Do not invent a synthetic ID or prefix with the jurisdiction.",
  ),
  title_en: z.string().min(1),
  title_es: z.string().min(1),

  // The plain-language summary is the single most important field. 8th-grade
  // reading level, faithful to the source text, written in both EN and ES as
  // peers (not machine translation).
  plain_summary_en: z.string().min(1),
  plain_summary_es: z.string().min(1),

  what_yes_means_en: z.string().min(1),
  what_yes_means_es: z.string().min(1),
  what_no_means_en: z.string().min(1),
  what_no_means_es: z.string().min(1),

  fiscal_impact_en: z.string().nullable(),
  fiscal_impact_es: z.string().nullable(),

  arguments: z.array(MeasureArgument).default([]),
  impacts: z.array(MeasureImpact).default([]),
  supporters: z.array(NamedParty).default([]),
  opponents: z.array(NamedParty).default([]),
  funding: FundingSummary.nullable(),

  source_citations: z.array(SourceCitation).min(1),

  // Free-form notes from the model about anything it couldn't determine,
  // ambiguities in the source, or calls that required judgment. Surfaces
  // to the human reviewer so they know where to look first.
  reviewer_notes_en: z.string().nullable(),
});
export type ExtractedMeasure = z.infer<typeof ExtractedMeasure>;

// JSON schema-ish view of the expected shape, embedded into the prompt so
// the model has a precise contract to follow. Keep the field names identical
// to the Zod schema above.
export const EXTRACTED_MEASURE_JSON_SHAPE = `{
  "code": string,
  "title_en": string,
  "title_es": string,
  "plain_summary_en": string,
  "plain_summary_es": string,
  "what_yes_means_en": string,
  "what_yes_means_es": string,
  "what_no_means_en": string,
  "what_no_means_es": string,
  "fiscal_impact_en": string | null,
  "fiscal_impact_es": string | null,
  "arguments": Array<{
    "side": "pro" | "con",
    "summary_en": string,
    "summary_es": string,
    "author": string | null  // ONLY the named signer(s) of the pamphlet argument itself, not endorsers or a supporter list. null if the source doesn't literally sign the argument.
  }>,
  "impacts": Array<{
    "topic": one of the allowed topic slugs below,
    "direction": -1 | 0 | 1,
    "confidence": integer 0..100,
    "rationale_en": string,
    "rationale_es": string
  }>,
  "supporters": Array<{ "name": string, "role": "support" }>,
  "opponents": Array<{ "name": string, "role": "oppose" }>,
  "funding": {
    "support_total_usd": number | null,  // best-effort integer; see is_approximate
    "oppose_total_usd": number | null,
    "is_approximate": boolean,            // true if the source uses "approximately", "about", "~", etc.
    "notes_en": string | null,
    "notes_es": string | null
  } | null,
  "source_citations": Array<{ "claim": string, "quote": string }>,
  "reviewer_notes_en": string | null
}`;
