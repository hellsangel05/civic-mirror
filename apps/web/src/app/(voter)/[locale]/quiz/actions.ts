"use server";

import { redirect } from "next/navigation";
import { writePriorities, clearPriorities, type Priorities } from "@/lib/priorities/cookie";
import { TOPIC_SLUGS, type TopicSlug } from "@/lib/topics";
import { routing } from "@/i18n/routing";

export async function submitQuizAction(formData: FormData): Promise<void> {
  const localeRaw = formData.get("locale");
  const locale =
    typeof localeRaw === "string" && (routing.locales as readonly string[]).includes(localeRaw)
      ? localeRaw
      : routing.defaultLocale;

  // Skip button clears all priorities and goes straight to ballot.
  if (formData.get("skip") === "1") {
    await clearPriorities();
    redirect(`/${locale}/ballot`);
  }

  // Read each topic slider out of the form. Zeros are preserved — they mean
  // "not important" and must survive the round-trip so the quiz shows the
  // correct position when the user comes back.
  const priorities: Priorities = {};
  for (const slug of TOPIC_SLUGS) {
    const raw = formData.get(slug);
    if (typeof raw !== "string") continue;
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    priorities[slug as TopicSlug] = Math.max(0, Math.min(1, n));
  }
  await writePriorities(priorities);

  redirect(`/${locale}/ballot`);
}
