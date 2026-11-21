import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PRIVATE_ROUTES = [
  "/dashboard",
  "/swimmers",
  "/sessions",
  "/attendance",
  "/memories",
  "/splits",
  "/reminders",
  "/analytics",
  "/calendar",
  "/settings",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const adminCookie = request.cookies.get("swimtrack_admin_session")?.value;

  // Sanity check on adminCookie: reject oversized, suspicious or malformed tokens
  const isCookieSuspicious =
    adminCookie && (adminCookie.length > 4096 || /[^\w\-.:]/.test(adminCookie));

  // In production, reject any legacy demo token unconditionally and nuke the cookie
  const isDemoBypassInProd =
    adminCookie === "swimtrack_demo_admin_authenticated_2026" &&
    process.env.NODE_ENV === "production";

  if (isCookieSuspicious || isDemoBypassInProd) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("swimtrack_admin_session");
    return response;
  }

  const isPrivateRoute = PRIVATE_ROUTES.some((route) =>
    pathname === route || pathname.startsWith(`${route}/`)
  );

  const isLoginPage = pathname === "/login";

  // Protect private routes from unauthenticated access
  if (isPrivateRoute) {
    if (!adminCookie) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Redirect away from login page if already authenticated
  if (isLoginPage && adminCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/swimmers/:path*",
    "/sessions/:path*",
    "/attendance/:path*",
    "/memories/:path*",
    "/splits/:path*",
    "/reminders/:path*",
    "/analytics/:path*",
    "/calendar/:path*",
    "/settings/:path*",
    "/login",
  ],
};

