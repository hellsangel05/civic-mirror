"use client";

import { useState } from "react";
import { TOPIC_SLUGS, type TopicSlug } from "@/lib/topics";
import { submitQuizAction } from "./actions";

interface QuizFormProps {
  locale: string;
  initialValues: Partial<Record<TopicSlug, number>>;
  topicLabels: Record<TopicSlug, string>;
  weightLabels: Record<string, string>;
  submitLabel: string;
  skipLabel: string;
  savedNote: string;
}

const STEPS = [0, 0.25, 0.5, 0.75, 1] as const;

export function QuizForm({
  locale,
  initialValues,
  topicLabels,
  weightLabels,
  submitLabel,
  skipLabel,
  savedNote,
}: QuizFormProps) {
  // Local state lets the user see the snap-to-step label update live without
  // round-tripping to the server. The actual save happens in the server action.
  const [values, setValues] = useState<Record<TopicSlug, number>>(() => {
    const seed = {} as Record<TopicSlug, number>;
    for (const slug of TOPIC_SLUGS) seed[slug] = initialValues[slug] ?? 0.5;
    return seed;
  });

  function setValue(slug: TopicSlug, v: number) {
    setValues((prev) => ({ ...prev, [slug]: v }));
  }

  function weightLabelFor(v: number): string {
    // Pick the closest defined label.
    let best: number = STEPS[0];
    let bestDist = Math.abs(v - best);
    for (const s of STEPS) {
      const d = Math.abs(v - s);
      if (d < bestDist) {
        best = s;
        bestDist = d;
      }
    }
    return weightLabels[String(best)] ?? "";
  }

  return (
    <form action={submitQuizAction} className="space-y-6">
      <input type="hidden" name="locale" value={locale} />
      <ul className="space-y-5">
        {TOPIC_SLUGS.map((slug) => {
          const v = values[slug];
          return (
            <li key={slug} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor={`slider-${slug}`} className="text-base font-semibold">
                  {topicLabels[slug]}
                </label>
                <span className="text-xs uppercase tracking-wide text-gray-600">
                  {weightLabelFor(v)}
                </span>
              </div>
              <input
                id={`slider-${slug}`}
                name={slug}
                type="range"
                min={0}
                max={1}
                step={0.25}
                value={v}
                onChange={(e) => setValue(slug, Number(e.target.value))}
                className="mt-3 w-full accent-blue-600"
                aria-valuemin={0}
                aria-valuemax={1}
                aria-valuenow={v}
                aria-valuetext={weightLabelFor(v)}
              />
              <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wide text-gray-400">
                <span>{weightLabels["0"]}</span>
                <span>{weightLabels["1"]}</span>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-gray-500">{savedNote}</p>
        <div className="flex gap-3">
          <button
            type="submit"
            name="skip"
            value="1"
            formNoValidate
            className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {skipLabel}
          </button>
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
