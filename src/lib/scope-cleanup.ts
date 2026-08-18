import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import type { ManagerScope } from "@/lib/types";

/**
 * Removes an auditor from every sub-admin's assignment.
 *
 * Called when an auditor is deactivated or deleted. A stale id is harmless to
 * read, but it makes the exclusivity check refuse to reassign that auditor to
 * anyone else later - the system would insist they are already managed by
 * someone who no longer manages them.
 */
export async function removeAuditorFromScopes(auditorId: string): Promise<void> {
  try {
    const db = adminDb();
    const managers = await db
      .collection("users")
      .where("role", "==", "manager")
      .get();

    const batch = db.batch();
    let touched = 0;

    for (const doc of managers.docs) {
      const scope = doc.data().scope as ManagerScope | undefined;
      const auditorIds = scope?.auditorIds ?? [];
      if (!auditorIds.includes(auditorId)) continue;

      batch.update(doc.ref, {
        scope: {
          districtIds: scope?.districtIds ?? [],
          auditorIds: auditorIds.filter((id) => id !== auditorId),
        },
        updatedAt: new Date().toISOString(),
      });
      touched++;
    }

    if (touched > 0) await batch.commit();
  } catch {
    // Tidy-up only - never block the deactivation that triggered it
  }
}
