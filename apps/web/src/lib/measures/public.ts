import "server-only";
import { getSupabaseBrowserClient } from "../supabase/browser";
import type { TopicSlug } from "../topics";

// Public (published-only) reads for the voter-facing site. These use the
// anon-key client, so Row Level Security is doing the filtering — if you
// see `review_status = 'published'` in the RLS policies but something
// slips through here, RLS is broken, not this file.
//
// Everything in this file is server-only even though the client it uses
// is technically browser-safe: fetching on the server keeps the rendered
// HTML cacheable and lets us avoid shipping Supabase query logic in the
// client bundle.

export interface PublicMeasureSummary {
  id: string;
  code: string;
  title_en: string;
  title_es: string;
  plain_summary_en: string;
  plain_summary_es: string;
  what_yes_means_en: string;
  what_yes_means_es: string;
  what_no_means_en: string;
  what_no_means_es: string;
  impacts: Array<{
    topic: TopicSlug;
    direction: -1 | 0 | 1;
    confidence: number;
    rationale_en: string;
    rationale_es: string;
  }>;
}

export interface PublicMeasureDetail extends PublicMeasureSummary {
  fiscal_impact_en: string | null;
  fiscal_impact_es: string | null;
  arguments: Array<{
    id: string;
    side: "pro" | "con";
    summary_en: string;
    summary_es: string;
    author: string | null;
  }>;
  endorsements: Array<{
    id: string;
    name: string;
    role: "support" | "oppose";
  }>;
  funding: Array<{
    id: string;
    side: "support" | "oppose";
    committee_name: string | null;
    total_raised_cents: number | null;
    is_approximate: boolean;
    notes_en: string | null;
    notes_es: string | null;
  }>;
  source_citations: Array<{ claim: string; quote: string }>;
  election: {
    id: string;
    jurisdiction: string;
    election_date: string;
    label_en: string;
    label_es: string;
  };
}

const SUMMARY_SELECT = `
  id, code, title_en, title_es,
  plain_summary_en, plain_summary_es,
  what_yes_means_en, what_yes_means_es,
  what_no_means_en, what_no_means_es,
  impacts:measure_impacts (
    direction, confidence, rationale_en, rationale_es,
    topic:topics!inner ( slug )
  )
`;

type RawSummary = {
  id: string;
  code: string;
  title_en: string;
  title_es: string;
  plain_summary_en: string;
  plain_summary_es: string;
  what_yes_means_en: string;
  what_yes_means_es: string;
  what_no_means_en: string;
  what_no_means_es: string;
  impacts: Array<{
    direction: -1 | 0 | 1;
    confidence: number;
    rationale_en: string;
    rationale_es: string;
    topic: { slug: string } | Array<{ slug: string }>;
  }>;
};

// Supabase REST sometimes returns the embedded `!inner` relation as an object
// and sometimes as a one-element array depending on the parser version. This
// flattens either shape.
function topicSlug(topic: RawSummary["impacts"][number]["topic"]): string {
  if (Array.isArray(topic)) return topic[0]?.slug ?? "";
  return topic.slug;
}

function normalizeSummary(row: RawSummary): PublicMeasureSummary {
  return {
    id: row.id,
    code: row.code,
    title_en: row.title_en,
    title_es: row.title_es,
    plain_summary_en: row.plain_summary_en,
    plain_summary_es: row.plain_summary_es,
    what_yes_means_en: row.what_yes_means_en,
    what_yes_means_es: row.what_yes_means_es,
    what_no_means_en: row.what_no_means_en,
    what_no_means_es: row.what_no_means_es,
    impacts: row.impacts.map((i) => ({
      topic: topicSlug(i.topic) as TopicSlug,
      direction: i.direction,
      confidence: i.confidence,
      rationale_en: i.rationale_en,
      rationale_es: i.rationale_es,
    })),
  };
}

// Current MVP assumption: one jurisdiction, one election. When we expand
// beyond LA Nov 2024 we'll take an election id as input.
const DEFAULT_JURISDICTION = "la-ca";
const DEFAULT_ELECTION_DATE = "2024-11-05";

export async function listPublishedMeasures(): Promise<PublicMeasureSummary[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("measures")
    .select(`${SUMMARY_SELECT}, elections!inner ( jurisdiction, election_date )`)
    .eq("elections.jurisdiction", DEFAULT_JURISDICTION)
    .eq("elections.election_date", DEFAULT_ELECTION_DATE)
    .order("code");
  if (error) throw new Error(`listPublishedMeasures failed: ${error.message}`);
  return (data ?? []).map((row) => normalizeSummary(row as unknown as RawSummary));
}

export async function getPublishedMeasureByCode(
  code: string,
): Promise<PublicMeasureDetail | null> {
  const supabase = getSupabaseBrowserClient();

  const { data: measure, error } = await supabase
    .from("measures")
    .select(`
      id, code, title_en, title_es,
      plain_summary_en, plain_summary_es,
      what_yes_means_en, what_yes_means_es,
      what_no_means_en, what_no_means_es,
      fiscal_impact_en, fiscal_impact_es,
      source_citations,
      election:elections!inner (
        id, jurisdiction, election_date, label_en, label_es
      ),
      impacts:measure_impacts (
        direction, confidence, rationale_en, rationale_es,
        topic:topics!inner ( slug )
      )
    `)
    .eq("code", code)
    .eq("elections.jurisdiction", DEFAULT_JURISDICTION)
    .eq("elections.election_date", DEFAULT_ELECTION_DATE)
    .maybeSingle();
  if (error) throw new Error(`getPublishedMeasureByCode failed: ${error.message}`);
  if (!measure) return null;

  const row = measure as unknown as RawSummary & {
    fiscal_impact_en: string | null;
    fiscal_impact_es: string | null;
    source_citations: Array<{ claim: string; quote: string }>;
    election:
      | {
          id: string;
          jurisdiction: string;
          election_date: string;
          label_en: string;
          label_es: string;
        }
      | Array<{
          id: string;
          jurisdiction: string;
          election_date: string;
          label_en: string;
          label_es: string;
        }>;
  };

  const election = Array.isArray(row.election) ? row.election[0] : row.election;
  if (!election) return null;

  const [argsRes, endorsementsRes, fundingRes] = await Promise.all([
    supabase
      .from("measure_arguments")
      .select("id, side, summary_en, summary_es, author")
      .eq("measure_id", row.id),
    supabase
      .from("measure_endorsements")
      .select("id, name, role")
      .eq("measure_id", row.id),
    supabase
      .from("measure_funding")
      .select("id, side, committee_name, total_raised_cents, is_approximate, notes_en, notes_es")
      .eq("measure_id", row.id),
  ]);
  if (argsRes.error) throw new Error(`arguments fetch failed: ${argsRes.error.message}`);
  if (endorsementsRes.error) throw new Error(`endorsements fetch failed: ${endorsementsRes.error.message}`);
  if (fundingRes.error) throw new Error(`funding fetch failed: ${fundingRes.error.message}`);

  const summary = normalizeSummary(row);
  return {
    ...summary,
    fiscal_impact_en: row.fiscal_impact_en,
    fiscal_impact_es: row.fiscal_impact_es,
    arguments: (argsRes.data ?? []) as PublicMeasureDetail["arguments"],
    endorsements: (endorsementsRes.data ?? []) as PublicMeasureDetail["endorsements"],
    funding: (fundingRes.data ?? []) as PublicMeasureDetail["funding"],
    source_citations: row.source_citations,
    election,
  };
}
