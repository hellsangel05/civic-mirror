import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");

  return (
    <div className="space-y-6 prose">
      <h1 className="text-3xl font-bold tracking-tight">{t("heading")}</h1>
      <p className="text-gray-700">{t("body")}</p>
    </div>
  );
}
