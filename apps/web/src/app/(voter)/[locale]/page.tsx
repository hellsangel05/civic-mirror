import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing");

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t("heading")}
        </h1>
        <p className="text-lg text-gray-700">{t("subheading")}</p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/quiz"
            className="rounded bg-blue-600 px-5 py-3 text-base font-semibold text-white hover:bg-blue-700"
          >
            {t("primaryCta")}
          </Link>
          <Link
            href="/ballot"
            className="rounded border border-gray-300 bg-white px-5 py-3 text-base font-semibold text-gray-800 hover:bg-gray-50"
          >
            {t("secondaryCta")}
          </Link>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold">{t("howItWorksHeading")}</h2>
        <ol className="space-y-2 text-sm text-gray-800">
          <li className="flex gap-3">
            <span className="font-bold text-blue-700">1.</span>
            <span>{t("step1")}</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-blue-700">2.</span>
            <span>{t("step2")}</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-blue-700">3.</span>
            <span>{t("step3")}</span>
          </li>
        </ol>
        <p className="text-xs text-gray-500">{t("trustNote")}</p>
      </section>
    </div>
  );
}
