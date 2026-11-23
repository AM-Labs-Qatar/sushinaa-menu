import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hostName } from "@/storefront/resolve";

const LEGACY_HOST = "sushinaa-menu.vercel.app";
const ADMIN_HOST = "admin.sushinaa.qa";
const MENU_ORIGIN = "https://menu.sushinaa.qa";

/**
 * OXiPOS may POST with a trailing slash. Next would 308 to the no-slash route and
 * drop the body — rewrite instead so both forms hit the same handler.
 */
export function rewritePosTrailingSlash(pathname: string): string | null {
  if (!pathname.startsWith("/api/pos/")) return null;
  if (!pathname.endsWith("/") || pathname === "/api/pos/") return null;
  return pathname.replace(/\/+$/, "");
}

/**
 * Host routing:
 * - legacy vercel.app → 301 to menu.sushinaa.qa
 * - admin.sushinaa.qa → CMS at `/` (rewrite to /admin); `/admin` URLs canonicalize away
 * - `/api/pos/…/` → rewrite without trailing slash (no redirect)
 */
export function proxy(request: NextRequest) {
  const host = hostName(request.headers.get("host"));
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

  const posPath = rewritePosTrailingSlash(pathname);
  if (posPath) {
    // Build a fresh URL — NextURL.clone() keeps a trailing slash on pathname.
    return NextResponse.rewrite(new URL(posPath + search, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
