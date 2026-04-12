// Fixed topic taxonomy. Must stay in sync with apps/ingest/src/topics.ts —
// if these ever drift, alignment scoring will break because measure_impacts
// rows ingested by one won't match the labels the other expects.

export const TOPIC_SLUGS = [
  "housing",
  "homelessness",
  "public-safety",
  "criminal-justice",
  "education",
  "transit",
  "climate",
  "healthcare",
  "taxes",
  "civil-rights",
  "government-reform",
  "economy",
] as const;

export type TopicSlug = (typeof TOPIC_SLUGS)[number];
