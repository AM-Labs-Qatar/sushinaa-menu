import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const LEGACY_HOST = "sushinaa-menu.vercel.app";
const ADMIN_HOST = "admin.sushinaa.qa";
const MENU_ORIGIN = "https://menu.sushinaa.qa";

function requestHost(request: NextRequest) {
  return (request.headers.get("host") ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .split(":")[0];
}

/**
 * Host routing:
 * - legacy vercel.app → 301 to menu.sushinaa.qa
 * - admin.sushinaa.qa → CMS at `/` (rewrite to /admin); `/admin` URLs canonicalize away
 */
export function proxy(request: NextRequest) {
  const host = requestHost(request);
  const { pathname, search } = request.nextUrl;

  if (host === LEGACY_HOST) {
    const dest = new URL(pathname + search, MENU_ORIGIN);
    return NextResponse.redirect(dest, 301);
  }

  if (host === ADMIN_HOST) {
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      const stripped = pathname.slice("/admin".length) || "/";
      return NextResponse.redirect(new URL(stripped + search, request.url), 308);
    }
    if (pathname === "/" || pathname === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = pathname === "/" ? "/admin" : "/admin/login";
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
