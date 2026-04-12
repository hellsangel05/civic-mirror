"use server";

import { revalidatePath } from "next/cache";
import { setMeasureReviewStatus, type ReviewStatus } from "@/lib/measures/admin";
import { requireAdminAccess } from "./guard";

const ALLOWED: readonly ReviewStatus[] = ["draft", "reviewed", "published"];

export async function updateReviewStatusAction(formData: FormData): Promise<void> {
  requireAdminAccess();
  const id = formData.get("id");
  const status = formData.get("status");
  if (typeof id !== "string" || typeof status !== "string") {
    throw new Error("updateReviewStatusAction: missing id or status");
  }
  if (!ALLOWED.includes(status as ReviewStatus)) {
    throw new Error(`updateReviewStatusAction: invalid status '${status}'`);
  }
  // Reviewer identity is a stub for now — no auth yet. When we add Supabase
  // auth, pull the operator email from the session and pass it here.
  await setMeasureReviewStatus(id, status as ReviewStatus, "operator@localhost");
  revalidatePath("/admin");
  revalidatePath(`/admin/${id}`);
}
