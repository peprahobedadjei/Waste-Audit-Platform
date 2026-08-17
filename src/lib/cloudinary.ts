import "server-only";

import { createHash } from "node:crypto";

/*
  Cloudinary signed uploads.

  The API secret never leaves the server. The device asks for a signature,
  uploads the photo straight to Cloudinary with it, and sends us back only the
  resulting public_id and URL. That keeps large image payloads off our own API
  while keeping the credential private.
*/

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

export type UploadSignature = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
  uploadUrl: string;
};

export function createUploadSignature(folder: string): UploadSignature {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary is not configured.");
  }

  const timestamp = Math.floor(Date.now() / 1000);

  // Cloudinary signs the alphabetically sorted parameter string plus the secret
  const params = `folder=${folder}&timestamp=${timestamp}`;
  const signature = createHash("sha1")
    .update(params + process.env.CLOUDINARY_API_SECRET)
    .digest("hex");

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME as string;

  return {
    cloudName,
    apiKey: process.env.CLOUDINARY_API_KEY as string,
    timestamp,
    folder,
    signature,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
  };
}
