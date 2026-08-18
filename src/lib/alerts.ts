import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { getBranding } from "@/lib/branding";
import type { ManagerScope } from "@/lib/types";

/*
  Alerts for dashboard users.

  Separate from the auditors' `notifications` collection: those are messages a
  manager chose to send, these are things the system noticed. Auditors never
  receive them - an auditor learning that their visit was flagged would work
  out the tolerance radius by trial and error, which is exactly what the silent
  submission flow prevents.
*/

export type AlertKind = "flagged_visit" | "missed_cluster";

export type AlertPrefs = {
  flaggedVisits: boolean;
  missedClusters: boolean;
  email: boolean;
};

export const DEFAULT_ALERT_PREFS: AlertPrefs = {
  flaggedVisits: true,
  missedClusters: true,
  email: false,
};

/** Everyone who should hear about something involving this auditor. */
async function recipientsFor(auditorId: string, districtId: string) {
  const db = adminDb();
  const snap = await db.collection("users").get();

  return snap.docs
    .filter((doc) => {
      const data = doc.data();
      if (data.status === "inactive") return false;
      if (data.role === "admin") return true;

      // A sub-admin hears about their own auditors only
      const scope = data.scope as ManagerScope | undefined;
      return (
        (scope?.auditorIds ?? []).includes(auditorId) ||
        (scope?.districtIds ?? []).includes(districtId)
      );
    })
    .map((doc) => ({
      id: doc.id,
      name: doc.data().name as string,
      email: doc.data().email as string,
      prefs: {
        ...DEFAULT_ALERT_PREFS,
        ...((doc.data().alertPrefs as Partial<AlertPrefs>) ?? {}),
      },
    }));
}

export async function raiseAlert(args: {
  kind: AlertKind;
  title: string;
  body: string;
  auditorId: string;
  districtId: string;
  link?: string;
}): Promise<void> {
  try {
    const db = adminDb();
    const now = new Date().toISOString();
    const people = await recipientsFor(args.auditorId, args.districtId);

    const wanted = people.filter((person) =>
      args.kind === "flagged_visit"
        ? person.prefs.flaggedVisits
        : person.prefs.missedClusters,
    );
    if (wanted.length === 0) return;

    const batch = db.batch();
    for (const person of wanted) {
      batch.set(db.collection("alerts").doc(), {
        userId: person.id,
        kind: args.kind,
        title: args.title,
        body: args.body,
        link: args.link ?? null,
        readAt: null,
        createdAt: now,
      });
    }
    await batch.commit();

    if (!isEmailConfigured()) return;

    const branding = await getBranding();
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "";

    for (const person of wanted.filter((p) => p.prefs.email)) {
      try {
        await sendEmail({
          to: person.email,
          subject: `${branding.appName} - ${args.title}`,
          text: `${args.body}\n\n${args.link ? base + args.link : ""}`,
          html: `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#111827">
                   <div style="display:inline-block;background:${branding.primaryColor};color:#fff;padding:8px 14px;border-radius:8px;font-weight:600;font-size:14px">${branding.appName}</div>
                   <h1 style="font-size:20px;margin:24px 0 12px">${args.title}</h1>
                   <p style="font-size:15px;line-height:1.6;margin:0 0 20px">${args.body}</p>
                   ${
                     args.link
                       ? `<a href="${base}${args.link}" style="display:inline-block;background:${branding.primaryColor};color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:15px">Open in the dashboard</a>`
                       : ""
                   }
                 </div>`,
        });
      } catch {
        // In-app alert already landed; email is the secondary channel
      }
    }
  } catch {
    // An alert must never break the submission that triggered it
  }
}

/**
 * Raised when several houses in one district report no collection in a cycle.
 * A single miss is ordinary; a cluster is the thing worth waking someone for -
 * especially after a Saturday collection, when the next one is five days away.
 */
export const MISSED_CLUSTER_THRESHOLD = 5;

export async function checkMissedCluster(args: {
  districtId: string;
  districtName: string;
  cycleId: string | null;
  auditorId: string;
}): Promise<void> {
  if (!args.cycleId) return;

  try {
    const snap = await adminDb()
      .collection("visits")
      .where("districtId", "==", args.districtId)
      .where("cycleId", "==", args.cycleId)
      .where("collected", "==", false)
      .get();

    // Alert once, on crossing the line - not on every submission after it
    if (snap.size !== MISSED_CLUSTER_THRESHOLD) return;

    await raiseAlert({
      kind: "missed_cluster",
      title: `${snap.size} uncollected houses in ${args.districtName}`,
      body: `${snap.size} households in ${args.districtName} have reported no collection for the ${args.cycleId} cycle.`,
      auditorId: args.auditorId,
      districtId: args.districtId,
      link: `/visits?district=${args.districtId}&collected=no`,
    });
  } catch {
    // Diagnostic only
  }
}
