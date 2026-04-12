# Sample data

These are **reconstructed representative inputs** for the LA County November 2024 election, assembled from public summaries (californiachoices.org, Ballotpedia, LAist) so we can prototype the extraction pipeline before we have the full official PDFs in hand.

**They are not the verbatim voter information pamphlet text.** Before Phase 1 ships for real, each measure's source must be replaced with the actual LA County Registrar-Recorder/County Clerk Sample Ballot Book section — the legal ballot question, impartial analysis by County Counsel, tax rate statement, arguments in favor, rebuttal to argument in favor, arguments against, rebuttal to argument against, full text of the measure.

Files:
- `measure-a-nov-2024.txt` — LA County Measure A: 0.5% sales tax for homelessness services and affordable housing
- `measure-g-nov-2024.txt` — LA County Measure G: County charter amendment (elected executive, ethics commission, expand Board of Supervisors)

Use these to validate the extraction pipeline produces good plain-language EN/ES output with faithful citations. If quality is good on these representative inputs, we graduate to real pamphlet PDFs.
