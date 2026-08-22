import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const companyUrl = request.nextUrl.searchParams.get("url")?.trim();
  if (!companyUrl) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/dashboard"
};
