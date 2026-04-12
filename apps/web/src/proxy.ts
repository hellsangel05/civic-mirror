import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except:
  // - API routes (handled separately)
  // - Next.js internals (/_next, /_vercel)
  // - Any path containing a dot (static files like favicon.ico, /window.svg)
  // /admin is intentionally excluded — it's an operator-only review tool
  // with no i18n, and it reads via the service-role client directly.
  matcher: "/((?!api|_next|_vercel|admin|.*\\..*).*)",
};
