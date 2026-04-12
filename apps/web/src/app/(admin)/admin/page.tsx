import Link from "next/link";
import { listAllMeasuresForAdmin, type ReviewStatus } from "@/lib/measures/admin";
import { updateReviewStatusAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<ReviewStatus, string> = {
  draft: "bg-yellow-100 text-yellow-900 border border-yellow-300",
  reviewed: "bg-blue-100 text-blue-900 border border-blue-300",
  published: "bg-green-100 text-green-900 border border-green-300",
};

export default async function AdminMeasuresPage() {
  const measures = await listAllMeasuresForAdmin();
  const drafts = measures.filter((m) => m.review_status === "draft");
  const published = measures.filter((m) => m.review_status === "published");
  const reviewed = measures.filter((m) => m.review_status === "reviewed");

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold">Measure review</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {measures.length} total · {drafts.length} draft · {reviewed.length} reviewed · {published.length} published
        </p>
      </section>

      {measures.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-300 bg-white p-6 text-sm text-neutral-500">
          No measures yet. Run{" "}
          <code className="rounded bg-neutral-100 px-1 py-0.5">npm run extract:measure-a:write</code> in{" "}
          <code className="rounded bg-neutral-100 px-1 py-0.5">apps/ingest</code>.
        </p>
      ) : (
        <ul className="space-y-3">
          {measures.map((m) => (
            <li
              key={m.id}
              className="rounded border border-neutral-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <span>{m.election.jurisdiction.toUpperCase()}</span>
                    <span>·</span>
                    <span>{m.election.election_date}</span>
                    <span
                      className={`ml-2 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[m.review_status]}`}
                    >
                      {m.review_status}
                    </span>
                  </div>
                  <h2 className="mt-1 text-lg font-semibold">
                    <Link href={`/admin/${m.id}`} className="hover:underline">
                      {m.code} — {m.title_en}
                    </Link>
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm text-neutral-700">
                    {m.plain_summary_en}
                  </p>
                </div>
                <PublishControls id={m.id} status={m.review_status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PublishControls({ id, status }: { id: string; status: ReviewStatus }) {
  // Simple state machine: draft → reviewed → published → (unpublish back to draft).
  return (
    <div className="flex shrink-0 flex-col gap-2">
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
      {status === "published" && (
        <form action={updateReviewStatusAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value="draft" />
          <button
            type="submit"
            className="rounded border border-neutral-400 bg-white px-3 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Unpublish
          </button>
        </form>
      )}
    </div>
  );
}
