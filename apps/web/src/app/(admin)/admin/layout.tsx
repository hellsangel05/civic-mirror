import type { ReactNode } from "react";
import Link from "next/link";
import { requireAdminAccess } from "./guard";
import "../../globals.css";

export const metadata = {
  title: "Civic Mirror — Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  requireAdminAccess();
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50 font-sans text-neutral-900 antialiased">
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/admin" className="text-sm font-semibold uppercase tracking-wide">
              Civic Mirror · Review
            </Link>
            <span className="text-xs text-neutral-500">operator-only</span>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
