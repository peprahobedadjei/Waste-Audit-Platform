import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { badRequest, requireAdmin, serverError } from "@/lib/api-auth";
import type { ManagerScope } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Updates a sub-admin's assignment or status. */
export async function PATCH(request: Request, { params }: Params) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  if (id === user.uid) {
    return badRequest("You cannot change your own access from here.");
  }

  let body: {
    scope?: ManagerScope;
    status?: "invited" | "active" | "inactive";
    name?: string;
  };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  try {
    const db = adminDb();
    const ref = db.collection("users").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Sub-admin not found." }, { status: 404 });
    }
    if (snap.data()?.role === "admin") {
      return badRequest("The system administrator's access cannot be scoped.");
    }

    const update: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) return badRequest("Name cannot be empty.");
      update.name = name;
      await adminAuth().updateUser(id, { displayName: name });
    }

    if (body.scope) {
      const districtIds = [...new Set(body.scope.districtIds ?? [])];
      const auditorIds = [...new Set(body.scope.auditorIds ?? [])];

      // Every assigned auditor must exist and sit inside an assigned district
      if (auditorIds.length > 0) {
        const auditorSnaps = await Promise.all(
          auditorIds.map((auditorId) =>
            db.collection("auditors").doc(auditorId).get(),
          ),
        );
        for (const auditorSnap of auditorSnaps) {
          if (!auditorSnap.exists) {
            return badRequest("One of the selected auditors no longer exists.");
          }
          const auditorDistrict = auditorSnap.data()?.districtId as string;
          if (!districtIds.includes(auditorDistrict)) {
            return badRequest(
              `${auditorSnap.data()?.name} is in a district you have not assigned. Assign the district first.`,
            );
          }
        }

        /*
          An auditor answers to exactly one sub-admin. Without this, two people
          could review the same auditor's flags and reach different decisions,
          and neither would be accountable for the outcome.
        */
        const others = await db
          .collection("users")
          .where("role", "==", "manager")
          .get();

        const taken = new Map<string, string>();
        for (const other of others.docs) {
          if (other.id === id) continue;
          const otherScope = other.data().scope as ManagerScope | undefined;
          for (const auditorId of otherScope?.auditorIds ?? []) {
            taken.set(auditorId, other.data().name as string);
          }
        }

        const conflicts = auditorIds.filter((auditorId) => taken.has(auditorId));
        if (conflicts.length > 0) {
          const names = await Promise.all(
            conflicts.slice(0, 3).map(async (auditorId) => {
              const doc = await db.collection("auditors").doc(auditorId).get();
              return `${doc.data()?.name ?? auditorId} (assigned to ${taken.get(auditorId)})`;
            }),
          );
          return badRequest(
            `Already assigned to another sub-admin: ${names.join(", ")}${
              conflicts.length > 3 ? ` and ${conflicts.length - 3} more` : ""
            }.`,
          );
        }
      }

      update.scope = { districtIds, auditorIds };
    }

    if (body.status !== undefined) {
      update.status = body.status;
      await adminAuth().updateUser(id, { disabled: body.status === "inactive" });
      if (body.status === "inactive") {
        // Revoking tokens ends their session now rather than at cookie expiry
        await adminAuth().revokeRefreshTokens(id);
      }
    }

    await ref.update(update);

    await db.collection("auditLog").add({
      userId: user.uid,
      action: "manager.update",
      targetType: "user",
      targetId: id,
      detail: update,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return serverError("Could not update the sub-admin.");
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  if (id === user.uid) {
    return badRequest("You cannot remove your own account.");
  }

  try {
    const db = adminDb();
    const snap = await db.collection("users").doc(id).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Sub-admin not found." }, { status: 404 });
    }
    if (snap.data()?.role === "admin") {
      return badRequest("The system administrator cannot be removed.");
    }

    const now = new Date().toISOString();

    // Reviews and messages carry this person's name, so the account is
    // deactivated rather than deleted - the audit trail has to stay readable.
    await db.collection("users").doc(id).update({
      status: "inactive",
      scope: { districtIds: [], auditorIds: [] },
      updatedAt: now,
    });
    await adminAuth().updateUser(id, { disabled: true });
    await adminAuth().revokeRefreshTokens(id);

    await db.collection("auditLog").add({
      userId: user.uid,
      action: "manager.deactivate",
      targetType: "user",
      targetId: id,
      detail: {},
      createdAt: now,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return serverError("Could not remove the sub-admin.");
  }
}
