import "server-only";
import { getSupabaseServiceClient } from "../supabase/server";

// Admin-only measure reads. These use the service-role client, which bypasses
// RLS, so they can see drafts. Do NOT import this module from a client
// component — it would leak the service-role key into the browser bundle.

export type ReviewStatus = "draft" | "reviewed" | "published";

export interface AdminMeasureRow {
  id: string;
  code: string;
  title_en: string;
  title_es: string;
  review_status: ReviewStatus;
  plain_summary_en: string;
  plain_summary_es: string;
  what_yes_means_en: string;
  what_yes_means_es: string;
  what_no_means_en: string;
  what_no_means_es: string;
  fiscal_impact_en: string | null;
  fiscal_impact_es: string | null;
  reviewer_notes_en: string | null;
  source_citations: Array<{ claim: string; quote: string }>;
  updated_at: string;
  election: {
    id: string;
    jurisdiction: string;
    election_date: string;
    label_en: string;
  };
}

interface MeasureWithElectionRow {
  id: string;
  code: string;
  title_en: string;
  title_es: string;
  review_status: ReviewStatus;
  plain_summary_en: string;
  plain_summary_es: string;
  what_yes_means_en: string;
  what_yes_means_es: string;
  what_no_means_en: string;
  what_no_means_es: string;
  fiscal_impact_en: string | null;
  fiscal_impact_es: string | null;
  reviewer_notes_en: string | null;
  source_citations: Array<{ claim: string; quote: string }>;
  updated_at: string;
  election: {
    id: string;
    jurisdiction: string;
    election_date: string;
    label_en: string;
  } | null;
}

const MEASURE_SELECT = `
  id, code, title_en, title_es, review_status,
  plain_summary_en, plain_summary_es,
  what_yes_means_en, what_yes_means_es,
  what_no_means_en, what_no_means_es,
  fiscal_impact_en, fiscal_impact_es,
  reviewer_notes_en, source_citations, updated_at,
  election:elections!inner (
    id, jurisdiction, election_date, label_en
  )
`;

export async function listAllMeasuresForAdmin(): Promise<AdminMeasureRow[]> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("measures")
    .select(MEASURE_SELECT)
    .order("code");
  if (error) throw new Error(`listAllMeasuresForAdmin failed: ${error.message}`);
  return ((data ?? []) as unknown as MeasureWithElectionRow[])
    .filter((r): r is MeasureWithElectionRow & { election: NonNullable<MeasureWithElectionRow["election"]> } => r.election !== null)
    .map((r) => ({
      id: r.id,
      code: r.code,
      title_en: r.title_en,
      title_es: r.title_es,
      review_status: r.review_status,
      plain_summary_en: r.plain_summary_en,
      plain_summary_es: r.plain_summary_es,
      what_yes_means_en: r.what_yes_means_en,
      what_yes_means_es: r.what_yes_means_es,
      what_no_means_en: r.what_no_means_en,
      what_no_means_es: r.what_no_means_es,
      fiscal_impact_en: r.fiscal_impact_en,
      fiscal_impact_es: r.fiscal_impact_es,
      reviewer_notes_en: r.reviewer_notes_en,
      source_citations: r.source_citations,
      updated_at: r.updated_at,
      election: r.election,
    }));
}

export interface AdminMeasureDetail extends AdminMeasureRow {
  arguments: Array<{
    id: string;
    side: "pro" | "con";
    summary_en: string;
    summary_es: string;
    author: string | null;
  }>;
  impacts: Array<{
    id: string;
    topic_slug: string;
    topic_label_en: string;
    direction: -1 | 0 | 1;
    confidence: number;
    rationale_en: string;
    rationale_es: string;
  }>;
  endorsements: Array<{
    id: string;
    name: string;
    role: "support" | "oppose";
  }>;
  funding: Array<{
    id: string;
    side: "support" | "oppose";
    total_raised_cents: number | null;
    is_approximate: boolean;
    notes_en: string | null;
    notes_es: string | null;
  }>;
}

export async function getMeasureForAdmin(id: string): Promise<AdminMeasureDetail | null> {
  const supabase = getSupabaseServiceClient();
  const { data: measure, error } = await supabase
    .from("measures")
    .select(MEASURE_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getMeasureForAdmin failed: ${error.message}`);
  if (!measure) return null;

  const measureRow = measure as unknown as MeasureWithElectionRow;
  if (!measureRow.election) return null;

  const [argsRes, impactsRes, endorsementsRes, fundingRes] = await Promise.all([
    supabase
      .from("measure_arguments")
      .select("id, side, summary_en, summary_es, author")
      .eq("measure_id", id),
    supabase
      .from("measure_impacts")
      .select("id, direction, confidence, rationale_en, rationale_es, topic:topics!inner(slug, label_en)")
      .eq("measure_id", id),
    supabase
      .from("measure_endorsements")
      .select("id, name, role")
      .eq("measure_id", id),
    supabase
      .from("measure_funding")
      .select("id, side, total_raised_cents, is_approximate, notes_en, notes_es")
      .eq("measure_id", id),
  ]);

  if (argsRes.error) throw new Error(`arguments fetch failed: ${argsRes.error.message}`);
  if (impactsRes.error) throw new Error(`impacts fetch failed: ${impactsRes.error.message}`);
  if (endorsementsRes.error) throw new Error(`endorsements fetch failed: ${endorsementsRes.error.message}`);
  if (fundingRes.error) throw new Error(`funding fetch failed: ${fundingRes.error.message}`);

  return {
    id: measureRow.id,
    code: measureRow.code,
    title_en: measureRow.title_en,
    title_es: measureRow.title_es,
    review_status: measureRow.review_status,
    plain_summary_en: measureRow.plain_summary_en,
    plain_summary_es: measureRow.plain_summary_es,
    what_yes_means_en: measureRow.what_yes_means_en,
    what_yes_means_es: measureRow.what_yes_means_es,
    what_no_means_en: measureRow.what_no_means_en,
    what_no_means_es: measureRow.what_no_means_es,
    fiscal_impact_en: measureRow.fiscal_impact_en,
    fiscal_impact_es: measureRow.fiscal_impact_es,
    reviewer_notes_en: measureRow.reviewer_notes_en,
    source_citations: measureRow.source_citations,
    updated_at: measureRow.updated_at,
    election: measureRow.election,
    arguments: (argsRes.data ?? []) as AdminMeasureDetail["arguments"],
    impacts: ((impactsRes.data ?? []) as unknown as Array<{
      id: string;
      direction: -1 | 0 | 1;
      confidence: number;
      rationale_en: string;
      rationale_es: string;
      topic: { slug: string; label_en: string };
    }>).map((row) => ({
      id: row.id,
      topic_slug: row.topic.slug,
      topic_label_en: row.topic.label_en,
      direction: row.direction,
      confidence: row.confidence,
      rationale_en: row.rationale_en,
      rationale_es: row.rationale_es,
    })),
    endorsements: (endorsementsRes.data ?? []) as AdminMeasureDetail["endorsements"],
    funding: (fundingRes.data ?? []) as AdminMeasureDetail["funding"],
  };
}

export async function setMeasureReviewStatus(
  id: string,
  status: ReviewStatus,
  reviewedBy: string | null,
): Promise<void> {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase
    .from("measures")
    .update({
      review_status: status,
      reviewed_by: status === "draft" ? null : reviewedBy,
      reviewed_at: status === "draft" ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(`setMeasureReviewStatus failed: ${error.message}`);
}
