import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createUploadSignature, isCloudinaryConfigured } from "@/lib/cloudinary";

/**
 * Signed Cloudinary upload for dashboard users - profile photos and the app
 * logo. The API secret stays on the server; the browser uploads directly.
 */
export async function POST(request: Request) {
  const { error } = await requireUser();
  if (error) return error;

  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      { error: "Image uploads are not configured." },
      { status: 503 },
    );
  }

  let body: { kind?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const folder = body.kind === "logo" ? "branding" : "avatars";

  try {
    return NextResponse.json(createUploadSignature(folder));
  } catch {
    return NextResponse.json(
      { error: "Could not prepare the upload." },
      { status: 500 },
    );
  }
}
