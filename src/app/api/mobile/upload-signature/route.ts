import { NextResponse } from "next/server";
import { requireAuditor } from "@/lib/mobile-auth";
import { createUploadSignature, isCloudinaryConfigured } from "@/lib/cloudinary";

/**
 * Hands the device a short-lived signature so it can upload the photo straight
 * to Cloudinary. The API secret stays on the server and the image bytes never
 * pass through our API.
 */
export async function POST(request: Request) {
  const { auditor, error } = await requireAuditor(request);
  if (error) return error;

  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      { error: "Image uploads are not configured." },
      { status: 503 },
    );
  }

  try {
    const signature = createUploadSignature(`visits/${auditor.districtId}`);
    return NextResponse.json(signature);
  } catch {
    return NextResponse.json(
      { error: "Could not prepare the upload." },
      { status: 500 },
    );
  }
}
