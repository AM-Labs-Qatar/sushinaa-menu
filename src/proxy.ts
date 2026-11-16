import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const LEGACY_HOST = "sushinaa-menu.vercel.app";
const MENU_ORIGIN = "https://menu.sushinaa.qa";

/**
 * Redirect the old production Vercel hostname to menu.sushinaa.qa.
 * Host-based only — does not touch order.sushinaa.qa.
 */
export function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .split(":")[0];
  if (host !== LEGACY_HOST) return NextResponse.next();

  const dest = new URL(request.nextUrl.pathname + request.nextUrl.search, MENU_ORIGIN);
  return NextResponse.redirect(dest, 301);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
