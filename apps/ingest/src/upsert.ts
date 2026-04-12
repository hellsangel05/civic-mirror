import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExtractedMeasure } from "./schemas.ts";

// Writes one ExtractedMeasure into Supabase under the given election.
//
// Strategy: measures are upserted by (election_id, code). Children
// (arguments, impacts, supporters, opponents, funding) are simpler to
// replace wholesale than to diff — we delete the existing children and
// re-insert. This is safe because everything still lives in
// `review_status = 'draft'` until a human publishes it, and because all
// children are owned by the parent measure via cascade FKs.
//
// Nothing here ever sets review_status to 'published'. Publishing is a
// human action that happens in the admin UI.

export interface ElectionRef {
  jurisdiction: string;    // 'la-ca'
  election_date: string;   // 'YYYY-MM-DD'
  type: "general" | "primary" | "special" | "runoff";
  label_en: string;
  label_es: string;
}

export interface UpsertResult {
  electionId: string;
  measureId: string;
  action: "inserted" | "updated";
  counts: {
    arguments: number;
    impacts: number;
    supporters: number;
    opponents: number;
    funding: number;
  };
}

export async function ensureElection(
  supabase: SupabaseClient,
  ref: ElectionRef,
): Promise<string> {
  const { data: existing, error: selectErr } = await supabase
    .from("elections")
    .select("id")
    .eq("jurisdiction", ref.jurisdiction)
    .eq("election_date", ref.election_date)
    .eq("type", ref.type)
    .maybeSingle();
  if (selectErr) throw new Error(`ensureElection select failed: ${selectErr.message}`);
  if (existing?.id) return existing.id as string;

  const { data: inserted, error: insertErr } = await supabase
    .from("elections")
    .insert({
      jurisdiction: ref.jurisdiction,
      election_date: ref.election_date,
      type: ref.type,
      label_en: ref.label_en,
      label_es: ref.label_es,
    })
    .select("id")
    .single();
  if (insertErr) throw new Error(`ensureElection insert failed: ${insertErr.message}`);
  return inserted.id as string;
}

async function loadTopicMap(supabase: SupabaseClient): Promise<Map<string, string>> {
  const { data, error } = await supabase.from("topics").select("id, slug");
  if (error) throw new Error(`loadTopicMap failed: ${error.message}`);
  const map = new Map<string, string>();
  for (const row of data ?? []) map.set(row.slug as string, row.id as string);
  return map;
}

export async function upsertMeasure(
  supabase: SupabaseClient,
  electionId: string,
  measure: ExtractedMeasure,
  officialTextUrl: string | null,
): Promise<UpsertResult> {
  const topicMap = await loadTopicMap(supabase);

  // Check whether the measure already exists so we can report inserted vs
  // updated, and so we can clean up children before re-inserting them.
  const { data: existing, error: existingErr } = await supabase
    .from("measures")
    .select("id")
    .eq("election_id", electionId)
    .eq("code", measure.code)
    .maybeSingle();
  if (existingErr) throw new Error(`measure lookup failed: ${existingErr.message}`);

  const measureRow = {
    election_id: electionId,
    code: measure.code,
    title_en: measure.title_en,
    title_es: measure.title_es,
    official_text_url: officialTextUrl,
    plain_summary_en: measure.plain_summary_en,
    plain_summary_es: measure.plain_summary_es,
    what_yes_means_en: measure.what_yes_means_en,
    what_yes_means_es: measure.what_yes_means_es,
    what_no_means_en: measure.what_no_means_en,
    what_no_means_es: measure.what_no_means_es,
    fiscal_impact_en: measure.fiscal_impact_en,
    fiscal_impact_es: measure.fiscal_impact_es,
    review_status: "draft" as const,
    source_citations: measure.source_citations,
    reviewer_notes_en: measure.reviewer_notes_en,
    updated_at: new Date().toISOString(),
  };

  let measureId: string;
  let action: "inserted" | "updated";

  if (existing?.id) {
    measureId = existing.id as string;
    action = "updated";
    const { error: updateErr } = await supabase
      .from("measures")
      .update(measureRow)
      .eq("id", measureId);
    if (updateErr) throw new Error(`measure update failed: ${updateErr.message}`);

    // Wipe children so we can re-insert. Cascade FKs don't help here since
    // we're not deleting the measure itself.
    for (const table of [
      "measure_arguments",
      "measure_impacts",
      "measure_endorsements",
      "measure_funding",
    ]) {
      const { error } = await supabase.from(table).delete().eq("measure_id", measureId);
      if (error) throw new Error(`${table} delete failed: ${error.message}`);
    }
  } else {
    const { data: inserted, error: insertErr } = await supabase
      .from("measures")
      .insert(measureRow)
      .select("id")
      .single();
    if (insertErr) throw new Error(`measure insert failed: ${insertErr.message}`);
    measureId = inserted.id as string;
    action = "inserted";
  }

  // Arguments (pro/con pamphlet text)
  if (measure.arguments.length > 0) {
    const rows = measure.arguments.map((a) => ({
      measure_id: measureId,
      side: a.side,
      summary_en: a.summary_en,
      summary_es: a.summary_es,
      author: a.author,
    }));
    const { error } = await supabase.from("measure_arguments").insert(rows);
    if (error) throw new Error(`measure_arguments insert failed: ${error.message}`);
  }

  // Topic impacts — resolve topic slug → id, skip any unknown slugs loudly
  if (measure.impacts.length > 0) {
    const rows = measure.impacts.map((i) => {
      const topicId = topicMap.get(i.topic);
      if (!topicId) {
        throw new Error(
          `unknown topic slug '${i.topic}' — taxonomies out of sync between ingest and DB`,
        );
      }
      return {
        measure_id: measureId,
        topic_id: topicId,
        direction: i.direction,
        confidence: i.confidence,
        rationale_en: i.rationale_en,
        rationale_es: i.rationale_es,
      };
    });
    const { error } = await supabase.from("measure_impacts").insert(rows);
    if (error) throw new Error(`measure_impacts insert failed: ${error.message}`);
  }

  // Endorsements: supporters + opponents both go into the same table with
  // role 'support' | 'oppose'.
  const endorsementRows = [
    ...measure.supporters.map((s) => ({
      measure_id: measureId,
      name: s.name,
      role: "support" as const,
    })),
    ...measure.opponents.map((o) => ({
      measure_id: measureId,
      name: o.name,
      role: "oppose" as const,
    })),
  ];
  if (endorsementRows.length > 0) {
    const { error } = await supabase.from("measure_endorsements").insert(endorsementRows);
    if (error) throw new Error(`measure_endorsements insert failed: ${error.message}`);
  }

  // Funding. We store the support and oppose sides as separate rows so the
  // table can be joined against support/oppose queries cleanly. The funding
  // summary the extractor returns is per-measure (not per-side), so the
  // bilingual notes and is_approximate flag are mirrored onto each row we
  // write. A side is skipped entirely only if it has no total AND no notes
  // — in that case there's nothing for the UI to render.
  let fundingCount = 0;
  if (measure.funding) {
    const f = measure.funding;
    const fundingRows: Array<{
      measure_id: string;
      side: "support" | "oppose";
      committee_name: string | null;
      total_raised_cents: number | null;
      top_donors: unknown[];
      source_url: string | null;
      is_approximate: boolean;
      notes_en: string | null;
      notes_es: string | null;
    }> = [];
    const hasNotes = Boolean(f.notes_en || f.notes_es);
    if (f.support_total_usd !== null || hasNotes) {
      fundingRows.push({
        measure_id: measureId,
        side: "support",
        committee_name: null,
        total_raised_cents:
          f.support_total_usd !== null ? Math.round(f.support_total_usd * 100) : null,
        top_donors: [],
        source_url: null,
        is_approximate: f.is_approximate,
        notes_en: f.notes_en,
        notes_es: f.notes_es,
      });
    }
    if (f.oppose_total_usd !== null) {
      fundingRows.push({
        measure_id: measureId,
        side: "oppose",
        committee_name: null,
        total_raised_cents: Math.round(f.oppose_total_usd * 100),
        top_donors: [],
        source_url: null,
        is_approximate: f.is_approximate,
        notes_en: f.notes_en,
        notes_es: f.notes_es,
      });
    }
    if (fundingRows.length > 0) {
      const { error } = await supabase.from("measure_funding").insert(fundingRows);
      if (error) throw new Error(`measure_funding insert failed: ${error.message}`);
      fundingCount = fundingRows.length;
    }
  }

  return {
    electionId,
    measureId,
    action,
    counts: {
      arguments: measure.arguments.length,
      impacts: measure.impacts.length,
      supporters: measure.supporters.length,
      opponents: measure.opponents.length,
      funding: fundingCount,
    },
  };
}
