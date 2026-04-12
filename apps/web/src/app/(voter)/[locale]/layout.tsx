import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import "../../globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: t("siteName"),
    description: t("tagline"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const messages = await getMessages();
  const t = await getTranslations({ locale, namespace: "nav" });
  const otherLocale = locale === "en" ? "es" : "en";

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col bg-white text-gray-900`}
      >
        <NextIntlClientProvider messages={messages}>
          <header className="border-b border-gray-200">
            <nav className="max-w-3xl mx-auto flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <Link href="/" className="font-semibold text-base">
                Civic Mirror
              </Link>
              <div className="flex items-center gap-4">
                <Link href="/ballot">{t("ballot")}</Link>
                <Link href="/quiz">{t("quiz")}</Link>
                <Link href="/about">{t("about")}</Link>
                <Link href="/" locale={otherLocale} className="underline">
                  {t("switchLanguage")}
                </Link>
              </div>
            </nav>
          </header>
          <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
            {children}
          </main>
          <footer className="border-t border-gray-200 mt-8">
            <div className="max-w-3xl mx-auto px-4 py-6 text-xs text-gray-500">
              Civic Mirror · Nonpartisan · Los Angeles County
            </div>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
