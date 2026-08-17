import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { badRequest, requireUser, serverError } from "@/lib/api-auth";
import { createInvite, provisionAuthUser } from "@/lib/invites";
import { sendAuditorInvite } from "@/lib/email";
import { getBranding } from "@/lib/branding";
import { AUDITOR_CSV_HEADERS, parseCsv } from "@/lib/csv";

type RowResult = {
  row: number;
  name: string;
  email: string;
  district: string;
  status: "ok" | "error";
  message?: string;
};

/*
  Two-phase CSV upload.

  mode="validate" parses and checks every row against the existing data and
  returns a preview without writing anything. mode="commit" repeats the checks
  and then creates the accounts. The manager always sees exactly what is about
  to happen before 160 invites go out.
*/
export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  let body: { csv?: string; mode?: "validate" | "commit" };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  const csv = body.csv;
  const mode = body.mode ?? "validate";
  if (!csv?.trim()) return badRequest("The file is empty.");

  const rows = parseCsv(csv);
  if (rows.length < 2) {
    return badRequest("The file needs a header row and at least one auditor.");
  }

  const header = rows[0].map((h) => h.toLowerCase().trim());
  const missing = AUDITOR_CSV_HEADERS.filter((h) => !header.includes(h));
  if (missing.length > 0) {
    return badRequest(
      `Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. ` +
        `Expected: ${AUDITOR_CSV_HEADERS.join(", ")}`,
    );
  }

  const col = {
    name: header.indexOf("name"),
    phone: header.indexOf("phone"),
    email: header.indexOf("email"),
    district: header.indexOf("district"),
  };

  try {
    const db = adminDb();

    const [districtSnap, auditorSnap] = await Promise.all([
      db.collection("districts").get(),
      db.collection("auditors").get(),
    ]);

    const districtsByName = new Map<string, string>();
    for (const doc of districtSnap.docs) {
      districtsByName.set(
        (doc.data().name as string).toLowerCase().trim(),
        doc.id,
      );
    }

    const existingEmails = new Set(
      auditorSnap.docs.map((doc) => (doc.data().email as string).toLowerCase()),
    );

    const seenInFile = new Set<string>();
    const results: RowResult[] = [];
    const valid: {
      row: number;
      name: string;
      phone: string;
      email: string;
      districtId: string;
      districtName: string;
    }[] = [];

    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i];
      const name = (cells[col.name] ?? "").trim();
      const phone = col.phone >= 0 ? (cells[col.phone] ?? "").trim() : "";
      const email = (cells[col.email] ?? "").trim().toLowerCase();
      const districtName = (cells[col.district] ?? "").trim();
      const rowNumber = i + 1;

      const base = { row: rowNumber, name, email, district: districtName };

      if (!name) {
        results.push({ ...base, status: "error", message: "Name is missing." });
        continue;
      }
      if (!email) {
        results.push({ ...base, status: "error", message: "Email is missing." });
        continue;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        results.push({ ...base, status: "error", message: "Email is not valid." });
        continue;
      }
      if (existingEmails.has(email)) {
        results.push({
          ...base,
          status: "error",
          message: "An auditor with this email already exists.",
        });
        continue;
      }
      if (seenInFile.has(email)) {
        results.push({
          ...base,
          status: "error",
          message: "This email appears more than once in the file.",
        });
        continue;
      }

      const districtId = districtsByName.get(districtName.toLowerCase());
      if (!districtId) {
        results.push({
          ...base,
          status: "error",
          message: `No district named "${districtName}".`,
        });
        continue;
      }

      seenInFile.add(email);
      results.push({ ...base, status: "ok" });
      valid.push({ row: rowNumber, name, phone, email, districtId, districtName });
    }

    const summary = {
      total: results.length,
      valid: valid.length,
      invalid: results.length - valid.length,
    };

    if (mode === "validate") {
      return NextResponse.json({ mode, summary, results });
    }

    if (valid.length === 0) {
      return badRequest("No valid rows to import.");
    }

    const branding = await getBranding();
    const now = new Date().toISOString();
    let invited = 0;
    let emailFailures = 0;

    for (const entry of valid) {
      const uid = await provisionAuthUser({
        email: entry.email,
        name: entry.name,
      });

      await db.collection("auditors").doc(uid).set({
        name: entry.name,
        phone: entry.phone,
        email: entry.email,
        districtId: entry.districtId,
        status: "invited",
        invitedAt: now,
        activatedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      const inviteUrl = await createInvite(uid);

      try {
        await sendAuditorInvite({
          to: entry.email,
          auditorName: entry.name,
          districtName: entry.districtName,
          inviteUrl,
          appName: branding.appName,
        });
      } catch {
        // Account is created either way; the manager can resend from the list
        emailFailures++;
      }

      invited++;
    }

    await db.collection("auditLog").add({
      userId: user.uid,
      action: "auditor.bulk_import",
      targetType: "auditor",
      targetId: "bulk",
      detail: { invited, emailFailures, skipped: summary.invalid },
      createdAt: now,
    });

    return NextResponse.json({
      mode,
      summary: { ...summary, invited, emailFailures },
      results,
    });
  } catch {
    return serverError("Could not process the file.");
  }
}
