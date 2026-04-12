import { getTranslations, setRequestLocale } from "next-intl/server";
import { TOPIC_SLUGS, type TopicSlug } from "@/lib/topics";
import { readPriorities } from "@/lib/priorities/cookie";
import { QuizForm } from "./QuizForm";

export const dynamic = "force-dynamic";

export default async function QuizPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("quiz");

  const initial = await readPriorities();

  const topicLabels = {} as Record<TopicSlug, string>;
  for (const slug of TOPIC_SLUGS) {
    topicLabels[slug] = t(`topics.${slug}`);
  }
  const weightLabels: Record<string, string> = {
    "0": t("weightNot"),
    "0.25": t("weightSlightly"),
    "0.5": t("weightSomewhat"),
    "0.75": t("weightImportant"),
    "1": t("weightCritical"),
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("heading")}</h1>
      <p className="text-gray-700">{t("instructions")}</p>
      <QuizForm
        locale={locale}
        initialValues={initial}
        topicLabels={topicLabels}
        weightLabels={weightLabels}
        submitLabel={t("submit")}
        skipLabel={t("skip")}
        savedNote={t("savedNote")}
      />
    </div>
  );
}
