import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE_NAMES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
];

const PROTECTED_ROUTE_PREFIXES = ["/teams", "/dashboard"];

/**
 * Next.js 16 Proxy function providing optimistic route protection.
 *
 * NOTE: Cookie presence is treated strictly as an optimistic routing hint
 * to avoid flashing unauthenticated UI. It does NOT prove valid authentication
 * or team authorization. Authoritative checks are performed by server helpers
 * and Server Actions.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Bypass Next.js internals, static assets, and Better Auth API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // 2. Check for optimistic Better Auth session cookie presence
  const hasSessionCookie = SESSION_COOKIE_NAMES.some((cookieName) =>
    request.cookies.has(cookieName)
  );

  // 3. Determine if the target route is a protected page route
  const isProtectedRoute = PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  // 4. Redirect unauthenticated requests targeting protected routes to /sign-in
  if (isProtectedRoute && !hasSessionCookie) {
    const loginUrl = new URL("/sign-in", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static file extensions (svg, png, jpg, jpeg, gif, webp)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
