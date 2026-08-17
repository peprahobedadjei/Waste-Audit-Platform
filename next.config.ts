import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
    firebase-admin must not be bundled into the serverless function. It relies
    on dynamic requires and gRPC native bindings, which the bundler cannot
    trace - the function then crashes on load and every API route returns a
    bare 500 before our own error handling runs. Dev works either way, so this
    only shows up once deployed.
  */
  serverExternalPackages: ["firebase-admin", "google-gax", "protobufjs"],

  images: {
    remotePatterns: [
      // Logos and audit photos are served from Cloudinary
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};

export default nextConfig;
