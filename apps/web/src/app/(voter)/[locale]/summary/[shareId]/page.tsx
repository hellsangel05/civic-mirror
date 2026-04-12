import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function SummaryPage({
  params,
}: {
  params: Promise<{ locale: string; shareId: string }>;
}) {
  const { locale, shareId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("summary");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("heading")}</h1>
      <p className="text-xs text-gray-400 font-mono">share id: {shareId}</p>
    </div>
  );
}
