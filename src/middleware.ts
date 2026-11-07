import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PRIVATE_ROUTES = [
  "/dashboard",
  "/swimmers",
  "/sessions",
  "/attendance",
  "/reminders",
  "/analytics",
  "/calendar",
  "/settings",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const adminCookie = request.cookies.get("swimtrack_admin_session")?.value;

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

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/swimmers/:path*",
    "/sessions/:path*",
    "/attendance/:path*",
    "/reminders/:path*",
    "/analytics/:path*",
    "/calendar/:path*",
    "/settings/:path*",
    "/login",
  ],
};

