import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import {
  getPublishedMeasureByCode,
  type PublicMeasureDetail,
} from "@/lib/measures/public";
import { readPriorities, hasTakenQuiz } from "@/lib/priorities/cookie";
import { scoreMeasure, leanLabel } from "@/lib/alignment/score";
import { TOPIC_SLUGS, type TopicSlug } from "@/lib/topics";

export const dynamic = "force-dynamic";

export default async function MeasureDetailPage({
  params,
}: {
  params: Promise<{ locale: string; measureCode: string }>;
}) {
  const { locale, measureCode } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("measure");
  const tQuiz = await getTranslations("quiz");
  const tBallot = await getTranslations("ballot");

  const code = decodeURIComponent(measureCode);
  const [measure, priorities] = await Promise.all([
    getPublishedMeasureByCode(code),
    readPriorities(),
  ]);

  if (!measure) notFound();

  const isEs = locale === "es";
  const taken = hasTakenQuiz(priorities);
  const score = scoreMeasure(measure.impacts, priorities);
  const lean = leanLabel(score.raw);

  const topicLabels = {} as Record<TopicSlug, string>;
  for (const slug of TOPIC_SLUGS) topicLabels[slug] = tQuiz(`topics.${slug}`);

  const title = isEs ? measure.title_es : measure.title_en;
  const summary = isEs ? measure.plain_summary_es : measure.plain_summary_en;
  const yes = isEs ? measure.what_yes_means_es : measure.what_yes_means_en;
  const no = isEs ? measure.what_no_means_es : measure.what_no_means_en;
  const fiscal = isEs ? measure.fiscal_impact_es : measure.fiscal_impact_en;

  let leanLabelText: string;
  let leanClass: string;
  if (!taken) {
    leanLabelText = tBallot("leanUnknown");
    leanClass = "bg-gray-100 text-gray-700 border-gray-300";
  } else if (lean === "yes") {
    leanLabelText = tBallot("leanYes");
    leanClass = "bg-green-100 text-green-900 border-green-300";
  } else if (lean === "no") {
    leanLabelText = tBallot("leanNo");
    leanClass = "bg-red-100 text-red-900 border-red-300";
  } else {
    leanLabelText = tBallot("leanTossUp");
    leanClass = "bg-yellow-100 text-yellow-900 border-yellow-300";
  }

  const pros = measure.arguments.filter((a) => a.side === "pro");
  const cons = measure.arguments.filter((a) => a.side === "con");
  const supporters = measure.endorsements.filter((e) => e.role === "support");
  const opponents = measure.endorsements.filter((e) => e.role === "oppose");

  return (
    <article className="space-y-8">
      <nav className="text-sm">
        <Link href="/ballot" className="text-blue-700 hover:underline">
          {t("backToBallot")}
        </Link>
      </nav>

      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight">
            {measure.code} — {title}
          </h1>
          <span
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${leanClass}`}
          >
            {leanLabelText}
          </span>
        </div>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
          {t("summaryHeading")}
        </h2>
        <p className="text-base text-gray-900">{summary}</p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-lg border border-green-200 bg-green-50 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-green-900">
            {t("whatYesMeans")}
          </h2>
          <p className="mt-2 text-sm text-gray-900">{yes}</p>
        </section>
        <section className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-red-900">
            {t("whatNoMeans")}
          </h2>
          <p className="mt-2 text-sm text-gray-900">{no}</p>
        </section>
      </div>

      {fiscal && (
        <section className="rounded border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
            {t("fiscalImpact")}
          </h2>
          <p className="mt-2 text-sm text-gray-900">{fiscal}</p>
        </section>
      )}

      {taken && score.topContributors.length > 0 && (
        <section className="rounded border border-blue-200 bg-blue-50 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-blue-900">
            {t("yourLean")}
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {score.topContributors.map((c) => {
              const arrow = c.contribution > 0 ? "↑" : c.contribution < 0 ? "↓" : "·";
              return (
                <li key={c.topic}>
                  <span className="mr-1 font-bold">{arrow}</span>
                  {tBallot("becauseYouCareAbout")}{" "}
                  <span className="font-semibold">{topicLabels[c.topic]}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
            {t("argumentsFor")}
          </h2>
          {pros.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">—</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {pros.map((a) => (
                <li
                  key={a.id}
                  className="rounded border border-gray-200 bg-white p-3 text-sm"
                >
                  <p>{isEs ? a.summary_es : a.summary_en}</p>
                  {a.author && (
                    <p className="mt-1 text-xs text-gray-500">— {a.author}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
            {t("argumentsAgainst")}
          </h2>
          {cons.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">—</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {cons.map((a) => (
                <li
                  key={a.id}
                  className="rounded border border-gray-200 bg-white p-3 text-sm"
                >
                  <p>{isEs ? a.summary_es : a.summary_en}</p>
                  {a.author && (
                    <p className="mt-1 text-xs text-gray-500">— {a.author}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
            {t("supporters")}
          </h2>
          {supporters.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">—</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-gray-800">
              {supporters.map((e) => (
                <li key={e.id}>· {e.name}</li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
            {t("opponents")}
          </h2>
          {opponents.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">—</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-gray-800">
              {opponents.map((e) => (
                <li key={e.id}>· {e.name}</li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <FundingSection measure={measure} t={t} isEs={isEs} />

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
          {t("sources")}
        </h2>
        <p className="mt-1 text-xs text-gray-500">{t("sourcesIntro")}</p>
        <ul className="mt-2 space-y-2">
          {measure.source_citations.map((c, idx) => (
            <li
              key={idx}
              className="rounded border border-gray-200 bg-white p-3 text-sm"
            >
              <div className="text-xs font-semibold text-gray-600">{c.claim}</div>
              <blockquote className="mt-1 border-l-2 border-gray-300 pl-3 italic text-gray-800">
                “{c.quote}”
              </blockquote>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

function FundingSection({
  measure,
  t,
  isEs,
}: {
  measure: PublicMeasureDetail;
  t: (key: string) => string;
  isEs: boolean;
}) {
  if (measure.funding.length === 0) {
    return (
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
          {t("funding")}
        </h2>
        <p className="mt-2 text-sm text-gray-500">{t("noFunding")}</p>
      </section>
    );
  }
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
        {t("funding")}
      </h2>
      <ul className="mt-2 grid gap-3 sm:grid-cols-2">
        {measure.funding.map((f) => {
          const label = f.side === "support" ? t("fundingSupport") : t("fundingOppose");
          const dollars =
            f.total_raised_cents !== null
              ? formatDollars(f.total_raised_cents, f.is_approximate, t("approxPrefix"))
              : "—";
          const note = isEs ? f.notes_es : f.notes_en;
          return (
            <li
              key={f.id}
              className="rounded border border-gray-200 bg-white p-3 text-sm"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  {label}
                </span>
                <span className="text-base font-bold">{dollars}</span>
              </div>
              {note && <p className="mt-1 text-xs text-gray-700">{note}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function formatDollars(cents: number, approx: boolean, approxPrefix: string): string {
  const dollars = cents / 100;
  let formatted: string;
  if (dollars >= 1_000_000) {
    formatted = `$${(dollars / 1_000_000).toFixed(dollars >= 10_000_000 ? 0 : 1)}M`;
  } else if (dollars >= 1_000) {
    formatted = `$${(dollars / 1_000).toFixed(0)}K`;
  } else {
    formatted = `$${dollars.toFixed(0)}`;
  }
  return approx ? `${approxPrefix}${formatted}` : formatted;
}
