-- Civic Mirror — funding extensions
--
-- Adds the fields the Claude extractor has been producing since Run 2 of the
-- ingest prototype but that the DB was dropping on insert:
--
--   * is_approximate — true when the source uses hedging language
--     ("approximately", "about", "~", "over", "nearly", …) for the dollar
--     figure. The voter-facing UI contract is: render as `~$X` when true,
--     `$X` when false. Required so a reviewer doesn't have to re-check the
--     source PDF every time they want to know whether a number is exact.
--
--   * notes_en / notes_es — free-form bilingual context the extractor
--     attaches to a funding summary (e.g. "top donor is a real-estate PAC",
--     "oppose side did not file by deadline"). Not always present; nullable.
--
-- See apps/ingest/sample-data/EXTRACTION_QUALITY_NOTES.md → "Known
-- follow-ups still open" → the upsert.ts note — this migration is what
-- closes that gap.

alter table measure_funding
  add column is_approximate boolean not null default false,
  add column notes_en       text,
  add column notes_es       text;
