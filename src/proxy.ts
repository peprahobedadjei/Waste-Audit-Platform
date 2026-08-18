import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-shared";

/*
  Cheap gate only - it checks that a session cookie is present so unauthenticated
  traffic never reaches a dashboard route. The cookie is properly verified
  server-side in the dashboard layout, which is what actually protects the data.
*/
export function proxy(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = request.nextUrl;

  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/districts/:path*",
    "/auditors/:path*",
    "/houses/:path*",
    "/visits/:path*",
    "/flagged/:path*",
    "/messages/:path*",
    "/reports/:path*",
    "/branding/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/managers/:path*",
    "/activity/:path*",
    "/audit-log/:path*",
  ],
};
