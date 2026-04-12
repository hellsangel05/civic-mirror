import Link from "next/link";
import { notFound } from "next/navigation";
import { getMeasureForAdmin, type ReviewStatus } from "@/lib/measures/admin";
import { updateReviewStatusAction } from "../actions";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<ReviewStatus, string> = {
  draft: "bg-yellow-100 text-yellow-900 border border-yellow-300",
  reviewed: "bg-blue-100 text-blue-900 border border-blue-300",
  published: "bg-green-100 text-green-900 border border-green-300",
};

export default async function AdminMeasureDetailPage({
  params,
}: {
  params: Promise<{ measureId: string }>;
}) {
  const { measureId } = await params;
  const measure = await getMeasureForAdmin(measureId);
  if (!measure) notFound();

  return (
    <div className="space-y-8">
      <nav className="text-sm">
        <Link href="/admin" className="text-blue-700 hover:underline">
          ← All measures
        </Link>
      </nav>

      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span>{measure.election.jurisdiction.toUpperCase()}</span>
            <span>·</span>
            <span>{measure.election.election_date}</span>
            <span
              className={`ml-2 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[measure.review_status]}`}
            >
              {measure.review_status}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold">
            {measure.code} — {measure.title_en}
          </h1>
          <p className="mt-1 text-sm text-neutral-600 italic">{measure.title_es}</p>
        </div>
        <StatusActions id={measure.id} status={measure.review_status} />
      </header>

      <Section title="Plain summary">
        <BilingualPair en={measure.plain_summary_en} es={measure.plain_summary_es} />
      </Section>

      <div className="grid gap-6 md:grid-cols-2">
        <Section title="What a YES vote means">
          <BilingualPair en={measure.what_yes_means_en} es={measure.what_yes_means_es} />
        </Section>
        <Section title="What a NO vote means">
          <BilingualPair en={measure.what_no_means_en} es={measure.what_no_means_es} />
        </Section>
      </div>

      {(measure.fiscal_impact_en || measure.fiscal_impact_es) && (
        <Section title="Fiscal impact">
          <BilingualPair
            en={measure.fiscal_impact_en ?? "—"}
            es={measure.fiscal_impact_es ?? "—"}
          />
        </Section>
      )}

      {measure.reviewer_notes_en && (
        <Section title="Reviewer notes (from model)">
          <p className="whitespace-pre-wrap text-sm text-neutral-800">
            {measure.reviewer_notes_en}
          </p>
        </Section>
      )}

      <Section title={`Topic impacts (${measure.impacts.length})`}>
        {measure.impacts.length === 0 ? (
          <p className="text-sm text-neutral-500">No topic impacts tagged.</p>
        ) : (
          <ul className="space-y-2">
            {measure.impacts.map((i) => (
              <li
                key={i.id}
                className="rounded border border-neutral-200 bg-white p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{i.topic_label_en}</span>
                  <span className="text-xs text-neutral-600">
                    direction {formatDirection(i.direction)} · confidence {i.confidence}
                  </span>
                </div>
                <p className="mt-1 text-neutral-700">{i.rationale_en}</p>
                <p className="mt-1 text-neutral-500 italic">{i.rationale_es}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Arguments (${measure.arguments.length})`}>
        {measure.arguments.length === 0 ? (
          <p className="text-sm text-neutral-500">None.</p>
        ) : (
          <ul className="space-y-3">
            {measure.arguments.map((a) => (
              <li
                key={a.id}
                className="rounded border border-neutral-200 bg-white p-3 text-sm"
              >
                <div className="text-xs font-semibold uppercase tracking-wide">
                  {a.side === "pro" ? "Pro" : "Con"}
                  {a.author && <span className="ml-2 font-normal text-neutral-500">— {a.author}</span>}
                </div>
                <p className="mt-1">{a.summary_en}</p>
                <p className="mt-1 italic text-neutral-600">{a.summary_es}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Supporters & opponents (${measure.endorsements.length})`}>
        {measure.endorsements.length === 0 ? (
          <p className="text-sm text-neutral-500">None listed.</p>
        ) : (
          <ul className="grid gap-1 text-sm md:grid-cols-2">
            {measure.endorsements.map((e) => (
              <li key={e.id} className="flex items-baseline gap-2">
                <span
                  className={
                    e.role === "support"
                      ? "text-green-700 font-semibold"
                      : "text-red-700 font-semibold"
                  }
                >
                  {e.role === "support" ? "Support" : "Oppose"}
                </span>
                <span>{e.name}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Source citations (${measure.source_citations.length})`}>
        {measure.source_citations.length === 0 ? (
          <p className="text-sm text-neutral-500">None.</p>
        ) : (
          <ul className="space-y-2">
            {measure.source_citations.map((c, idx) => (
              <li
                key={idx}
                className="rounded border border-neutral-200 bg-white p-3 text-sm"
              >
                <div className="text-xs font-semibold text-neutral-600">{c.claim}</div>
                <blockquote className="mt-1 border-l-2 border-neutral-300 pl-3 italic text-neutral-800">
                  “{c.quote}”
                </blockquote>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-600">
        {title}
      </h2>
      {children}
    </section>
  );
}

function BilingualPair({ en, es }: { en: string; es: string }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded border border-neutral-200 bg-white p-3 text-sm">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          EN
        </div>
        <p className="whitespace-pre-wrap">{en}</p>
      </div>
      <div className="rounded border border-neutral-200 bg-white p-3 text-sm">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          ES
        </div>
        <p className="whitespace-pre-wrap italic">{es}</p>
      </div>
    </div>
  );
}

function formatDirection(d: -1 | 0 | 1): string {
  if (d === 1) return "+1 (advances)";
  if (d === -1) return "-1 (sets back)";
  return "0 (mixed)";
}

function StatusActions({ id, status }: { id: string; status: ReviewStatus }) {
  return (
    <div className="flex shrink-0 flex-col gap-2">
      {status !== "draft" && (
        <form action={updateReviewStatusAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value="draft" />
          <button
            type="submit"
            className="rounded border border-neutral-400 bg-white px-3 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Back to draft
          </button>
        </form>
      )}
      {status === "draft" && (
        <form action={updateReviewStatusAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value="reviewed" />
          <button
            type="submit"
            className="rounded border border-blue-600 bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Mark reviewed
          </button>
        </form>
      )}
      {status === "reviewed" && (
        <form action={updateReviewStatusAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value="published" />
          <button
            type="submit"
            className="rounded border border-green-700 bg-green-700 px-3 py-1 text-xs font-semibold text-white hover:bg-green-800"
          >
            Publish
          </button>
        </form>
      )}
    </div>
  );
}
