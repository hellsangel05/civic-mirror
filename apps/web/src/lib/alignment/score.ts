import type { TopicSlug } from "@/lib/topics";

// User priorities: how important each topic is to them, 0..1. Topics the user
// didn't weight explicitly are treated as 0 (they don't care). Direction comes
// from the measure's impact row, not from the user — that's the whole point
// of the rethink vs the old 2-slider model.
export type Priorities = Partial<Record<TopicSlug, number>>;

// One impact row, as produced by the ingest pipeline. direction is +1/0/-1
// from the perspective of someone who cares about advancing the topic;
// confidence is 0..100.
export interface MeasureImpact {
  topic: TopicSlug;
  direction: -1 | 0 | 1;
  confidence: number;
}

export interface AlignmentScore {
  // Signed number. Positive = leans YES, negative = leans NO, ~0 = toss-up.
  // Magnitude reflects how strongly the measure aligns with the user's
  // weighted priorities. Not bounded to [-1, 1] — the UI should format it
  // qualitatively ("strong match", "mixed") rather than showing the raw number.
  raw: number;
  // Which impact rows contributed most, for the "why" disclosure in the UI.
  topContributors: Array<{
    topic: TopicSlug;
    contribution: number;
    confidence: number;
  }>;
}

export function scoreMeasure(
  impacts: readonly MeasureImpact[],
  priorities: Priorities,
): AlignmentScore {
  const contributions: AlignmentScore["topContributors"] = [];
  let raw = 0;

  for (const impact of impacts) {
    const weight = priorities[impact.topic] ?? 0;
    if (weight === 0) continue;
    // Scale by confidence so low-confidence impacts (e.g. opposition talking
    // points the model flagged at 35/100) don't swing the score as hard as
    // structural effects flagged at 95/100.
    const contribution = weight * impact.direction * (impact.confidence / 100);
    raw += contribution;
    contributions.push({
      topic: impact.topic,
      contribution,
      confidence: impact.confidence,
    });
  }

  contributions.sort(
    (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution),
  );

  return {
    raw,
    topContributors: contributions.slice(0, 3),
  };
}

// Convenience label for the UI. Thresholds are deliberate guesses and should
// be tuned with real content before shipping.
export function leanLabel(score: number): "yes" | "no" | "toss-up" {
  if (score > 0.15) return "yes";
  if (score < -0.15) return "no";
  return "toss-up";
}
