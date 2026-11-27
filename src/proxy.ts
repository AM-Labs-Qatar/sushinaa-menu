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

function isPosApiPath(pathname: string) {
  return pathname === "/api/pos" || pathname.startsWith("/api/pos/");
}

/**
 * OXiPOS may POST with a trailing slash. A 308 would drop the body, so rewrite
 * both forms onto the same handler.
 */
export function rewritePosTrailingSlash(pathname: string): string | null {
  if (!isPosApiPath(pathname)) return null;
  if (!pathname.endsWith("/") || pathname === "/api/pos/") return null;
  return pathname.replace(/\/+$/, "");
}

/**
 * Next's default `trailingSlash: false` for every path that is not the POS API.
 * Returns the no-slash path, or null when this request must not 308.
 */
function pageTrailingSlashTarget(pathname: string): string | null {
  if (isPosApiPath(pathname)) return null;
  if (pathname === "/" || !pathname.endsWith("/")) return null;
  const stripped = pathname.replace(/\/+$/, "");
  return stripped || "/";
}

/**
 * Host routing:
 * - legacy vercel.app → 301 to menu.sushinaa.qa
 * - admin.sushinaa.qa → CMS at `/` (rewrite to /admin); `/admin` URLs canonicalize away
 * - `/api/pos/…/` → rewrite without trailing slash (no redirect)
 * - any other path ending in `/` → 308 to the no-slash path
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

  const posPath = rewritePosTrailingSlash(pathname);
  if (posPath) {
    // Build a fresh URL. NextURL.clone() keeps a trailing slash on pathname.
    return NextResponse.rewrite(new URL(posPath + search, request.url));
  }

  const canonical = pageTrailingSlashTarget(pathname);
  if (canonical) {
    return NextResponse.redirect(new URL(canonical + search, request.url), 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
