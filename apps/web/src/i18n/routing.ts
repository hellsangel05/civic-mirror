import { defineRouting } from "next-intl/routing";

// English and Spanish are peer languages in Civic Mirror — not translation
// afterthoughts. Both are always available and both are written as first-class
// content from source material.
export const routing = defineRouting({
  locales: ["en", "es"],
  defaultLocale: "en",
  // Always include the locale in the URL so /en/... and /es/... are both
  // explicit. This makes printable cheat-sheet URLs unambiguous and avoids
  // silent locale detection that users can't reason about.
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
