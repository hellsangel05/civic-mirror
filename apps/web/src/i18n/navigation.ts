import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Drop-in replacements for Next's Link/useRouter/redirect that automatically
// preserve the active locale in URLs. Use these everywhere in the app instead
// of importing from "next/link" or "next/navigation".
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
