import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { badRequest, requireUser, serverError } from "@/lib/api-auth";
import { scopeFor } from "@/lib/permissions";
import { sendEmail } from "@/lib/email";
import { getBranding } from "@/lib/branding";
import type { Message, MessageAudience } from "@/lib/types";

const FIRESTORE_BATCH_LIMIT = 500;

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const snap = await adminDb()
      .collection("messages")
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();

    let messages = snap.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as Message,
    );

    /*
      The system administrator sees every message. That is deliberate and it is
      disclosed in the compose screen - an accountability tool should not
      contain channels the person accountable for it cannot see. Sub-admins see
      only what they sent and what was addressed to them.
    */
    if (user.role !== "admin") {
      messages = messages.filter(
        (m) =>
          m.sentBy === user.uid ||
          (m.audience.type === "staff" &&
            (m.audience.userIds ?? []).includes(user.uid)),
      );
    }

    return NextResponse.json({ messages });
  } catch {
    return serverError("Could not load messages.");
  }
}

/**
 * Sends a message to auditors and fans it out into per-auditor notifications
 * they collect through the mobile app. Optionally emails it as well, for
 * anything that needs to land even if the auditor does not open the app.
 */
export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  let body: {
    title?: string;
    body?: string;
    audience?: MessageAudience;
    alsoEmail?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  const title = body.title?.trim();
  const text = body.body?.trim();
  const audience = body.audience;

  if (!title) return badRequest("A subject is required.");
  if (!text) return badRequest("A message is required.");
  if (!audience) return badRequest("Choose who this goes to.");

  try {
    const db = adminDb();
    const scope = scopeFor(user);

    // Resolve the audience to a concrete recipient list
    let recipients: { id: string; name: string; email: string }[] = [];
    let isStaffMessage = false;

    if (audience.type === "staff") {
      // Sub-admins talking to each other and to the system administrator.
      // Delivered in the dashboard, not to the auditors' app.
      isStaffMessage = true;
      if (!audience.userIds?.length) {
        return badRequest("Select at least one recipient.");
      }
      const snaps = await Promise.all(
        audience.userIds.map((id) => db.collection("users").doc(id).get()),
      );
      recipients = snaps
        .filter((snap) => snap.exists && snap.data()?.status !== "inactive")
        .map((snap) => ({
          id: snap.id,
          name: snap.data()!.name as string,
          email: snap.data()!.email as string,
        }));
    } else if (audience.type === "all") {
      const snap = await db
        .collection("auditors")
        .where("status", "in", ["invited", "active"])
        .get();
      recipients = snap.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name as string,
        email: doc.data().email as string,
      }));
    } else if (audience.type === "district") {
      if (!audience.districtId) return badRequest("Choose a district.");
      const snap = await db
        .collection("auditors")
        .where("districtId", "==", audience.districtId)
        .where("status", "in", ["invited", "active"])
        .get();
      recipients = snap.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name as string,
        email: doc.data().email as string,
      }));
    } else if (audience.type === "auditors") {
      if (!audience.auditorIds?.length) {
        return badRequest("Select at least one auditor.");
      }
      const snaps = await Promise.all(
        audience.auditorIds.map((id) =>
          db.collection("auditors").doc(id).get(),
        ),
      );
      recipients = snaps
        .filter((snap) => snap.exists)
        .map((snap) => ({
          id: snap.id,
          name: snap.data()!.name as string,
          email: snap.data()!.email as string,
        }));
    }

    /*
      A sub-admin may only message the auditors they manage. Enforced here
      rather than in the compose screen, because the screen only decides what is
      offered - this decides what is permitted.
    */
    if (!isStaffMessage && scope.kind === "scoped") {
      const outOfScope = recipients.filter(
        (r) => !scope.auditorIds.includes(r.id),
      );
      if (outOfScope.length > 0) {
        return NextResponse.json(
          {
            error:
              "You can only message auditors assigned to you. Remove the others and try again.",
          },
          { status: 403 },
        );
      }
    }

    if (recipients.length === 0) {
      return badRequest("That selection has no one in it.");
    }

    const now = new Date().toISOString();

    const messageRef = await db.collection("messages").add({
      title,
      body: text,
      audience,
      recipientCount: recipients.length,
      alsoEmail: Boolean(body.alsoEmail),
      sentBy: user.uid,
      sentByName: user.name,
      createdAt: now,
    });

    // Staff messages are read in the dashboard, so they need no per-auditor
    // notification records - only the auditors' app polls that collection.
    if (!isStaffMessage) {
      // Firestore caps a batch at 500 writes, so chunk for 160+ auditors.
      for (let i = 0; i < recipients.length; i += FIRESTORE_BATCH_LIMIT) {
        const chunk = recipients.slice(i, i + FIRESTORE_BATCH_LIMIT);
        const batch = db.batch();
        for (const recipient of chunk) {
          batch.set(db.collection("notifications").doc(), {
            auditorId: recipient.id,
            messageId: messageRef.id,
            title,
            body: text,
            // Denormalised onto the notification so the app can show who sent
            // it without a second lookup per message
            sentBy: user.uid,
            sentByName: user.name,
            sentByRole: user.role,
            readAt: null,
            createdAt: now,
          });
        }
        await batch.commit();
      }
    }

    let emailsSent = 0;
    let emailsFailed = 0;

    if (body.alsoEmail) {
      const branding = await getBranding();
      for (const recipient of recipients) {
        try {
          await sendEmail({
            to: recipient.email,
            subject: `${branding.appName} - ${title}`,
            text: `Hello ${recipient.name},\n\n${text}\n`,
            html: `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#111827">
                     <div style="display:inline-block;background:#16a34a;color:#fff;padding:8px 14px;border-radius:8px;font-weight:600;font-size:14px">${branding.appName}</div>
                     <h1 style="font-size:20px;margin:24px 0 12px">${title}</h1>
                     <p style="font-size:15px;line-height:1.6;white-space:pre-wrap;margin:0">${text}</p>
                   </div>`,
          });
          emailsSent++;
        } catch {
          // The in-app notification already landed; email is the extra channel
          emailsFailed++;
        }
      }
    }

    await db.collection("auditLog").add({
      userId: user.uid,
      action: "message.send",
      targetType: "message",
      targetId: messageRef.id,
      detail: {
        title,
        audience,
        recipientCount: recipients.length,
        emailsSent,
        emailsFailed,
      },
      createdAt: now,
    });

    return NextResponse.json(
      {
        id: messageRef.id,
        recipientCount: recipients.length,
        emailsSent,
        emailsFailed,
      },
      { status: 201 },
    );
  } catch {
    return serverError("Could not send the message.");
  }
}
