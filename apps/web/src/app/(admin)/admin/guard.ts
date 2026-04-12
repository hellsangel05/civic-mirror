import "server-only";
import { notFound } from "next/navigation";

// Blunt admin guard: in production, /admin 404s unless ADMIN_ENABLED is set.
// In development, it's always available. This is intentionally crude — the
// real plan is to either bind it to a separate subdomain with basic auth, or
// gate it behind Supabase auth once we have it. For now, it's operator-only
// on localhost.
export function requireAdminAccess(): void {
  if (process.env.NODE_ENV === "production" && process.env.ADMIN_ENABLED !== "1") {
    notFound();
  }
}
