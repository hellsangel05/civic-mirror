import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listPublishedMeasures, type PublicMeasureSummary } from "@/lib/measures/public";
import { readPriorities, hasTakenQuiz } from "@/lib/priorities/cookie";
import { scoreMeasure, leanLabel, type AlignmentScore } from "@/lib/alignment/score";
import { TOPIC_SLUGS, type TopicSlug } from "@/lib/topics";

export const dynamic = "force-dynamic";

interface ScoredMeasure {
  measure: PublicMeasureSummary;
  score: AlignmentScore;
  lean: "yes" | "no" | "toss-up";
}

export default async function BallotPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tBallot = await getTranslations("ballot");
  const tQuiz = await getTranslations("quiz");

  const [measures, priorities] = await Promise.all([
    listPublishedMeasures(),
    readPriorities(),
  ]);
  const taken = hasTakenQuiz(priorities);

  const scored: ScoredMeasure[] = measures.map((m) => {
    const score = scoreMeasure(m.impacts, priorities);
    return { measure: m, score, lean: leanLabel(score.raw) };
  });

  // When the user has priorities, sort by absolute alignment magnitude
  // (strongest matches first, regardless of yes vs no). When they don't,
  // fall back to ballot order (which the fetcher already gives us).
  if (taken) {
    scored.sort((a, b) => Math.abs(b.score.raw) - Math.abs(a.score.raw));
  }

  const topicLabels = {} as Record<TopicSlug, string>;
  for (const slug of TOPIC_SLUGS) topicLabels[slug] = tQuiz(`topics.${slug}`);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{tBallot("heading")}</h1>
        <p className="text-gray-700">
          {taken ? tBallot("subheading") : tBallot("noPriorities")}
        </p>
        <div>
          <Link
            href="/quiz"
            className="inline-block rounded border border-blue-600 bg-white px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            {taken ? tBallot("retakeQuiz") : tBallot("takeQuiz")}
          </Link>
        </div>
      </header>

      {scored.length === 0 ? (
        <p className="rounded border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
          {tBallot("emptyState")}
        </p>
      ) : (
        <ul className="space-y-4">
          {scored.map(({ measure, score, lean }) => (
            <MeasureCard
              key={measure.id}
              locale={locale}
              measure={measure}
              score={score}
              lean={lean}
              taken={taken}
              topicLabels={topicLabels}
              t={{
                viewMeasure: tBallot("viewMeasure"),
                leanYes: tBallot("leanYes"),
                leanNo: tBallot("leanNo"),
                leanTossUp: tBallot("leanTossUp"),
                leanUnknown: tBallot("leanUnknown"),
                whyHeading: tBallot("whyHeading"),
                becauseYouCareAbout: tBallot("becauseYouCareAbout"),
                noContributors: tBallot("noContributors"),
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface CardLabels {
  viewMeasure: string;
  leanYes: string;
  leanNo: string;
  leanTossUp: string;
  leanUnknown: string;
  whyHeading: string;
  becauseYouCareAbout: string;
  noContributors: string;
}

function MeasureCard({
  locale,
  measure,
  score,
  lean,
  taken,
  topicLabels,
  t,
}: {
  locale: string;
  measure: PublicMeasureSummary;
  score: AlignmentScore;
  lean: "yes" | "no" | "toss-up";
  taken: boolean;
  topicLabels: Record<TopicSlug, string>;
  t: CardLabels;
}) {
  const isEs = locale === "es";
  const title = isEs ? measure.title_es : measure.title_en;
  const summary = isEs ? measure.plain_summary_es : measure.plain_summary_en;

  let leanLabelText: string;
  let leanClass: string;
  if (!taken) {
    leanLabelText = t.leanUnknown;
    leanClass = "bg-gray-100 text-gray-700 border-gray-300";
  } else if (lean === "yes") {
    leanLabelText = t.leanYes;
    leanClass = "bg-green-100 text-green-900 border-green-300";
  } else if (lean === "no") {
    leanLabelText = t.leanNo;
    leanClass = "bg-red-100 text-red-900 border-red-300";
  } else {
    leanLabelText = t.leanTossUp;
    leanClass = "bg-yellow-100 text-yellow-900 border-yellow-300";
  }

  return (
    <li className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-xl font-bold">
          <Link
            href={`/ballot/${encodeURIComponent(measure.code)}`}
            className="hover:underline"
          >
            {measure.code} — {title}
          </Link>
        </h2>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${leanClass}`}
        >
          {leanLabelText}
        </span>
      </div>

      <p className="mt-3 text-sm text-gray-800">{summary}</p>

      {taken && score.topContributors.length > 0 && (
        <div className="mt-4 rounded border border-gray-100 bg-gray-50 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">
            {t.whyHeading}
          </div>
          <ul className="mt-1 space-y-1 text-sm text-gray-800">
            {score.topContributors.map((c) => {
              const dirArrow =
                c.contribution > 0 ? "↑" : c.contribution < 0 ? "↓" : "·";
              return (
                <li key={c.topic}>
                  <span aria-hidden="true" className="mr-1 font-bold">
                    {dirArrow}
                  </span>
                  {t.becauseYouCareAbout}{" "}
                  <span className="font-semibold">{topicLabels[c.topic]}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {taken && score.topContributors.length === 0 && (
        <p className="mt-3 text-xs text-gray-500">{t.noContributors}</p>
      )}

      <div className="mt-4">
        <Link
          href={`/ballot/${encodeURIComponent(measure.code)}`}
          className="text-sm font-semibold text-blue-700 hover:underline"
        >
          {t.viewMeasure} →
        </Link>
      </div>
    </li>
  );
}
