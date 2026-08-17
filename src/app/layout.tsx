import type { Metadata } from "next";
import { Sora } from "next/font/google";
import "./globals.css";
import { getBranding, brandingToCssVars } from "@/lib/branding";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding();
  return {
    title: branding.appName,
    description: "Independent waste collection audit and monitoring system",
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const branding = await getBranding();

  return (
    <html lang="en" className={`${sora.variable} h-full antialiased`}>
      <head>
        {/* Runtime branding overrides - admin-configurable colours */}
        <style
          dangerouslySetInnerHTML={{
            __html: `:root{${brandingToCssVars(branding)}}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
