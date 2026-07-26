import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (token) return NextResponse.next();

  // Atalho de auto-login (sem senha, sempre como demo@filmmanager.local) só existe em
  // desenvolvimento local — em produção, qualquer visitante sem sessão precisa passar pelo
  // /login de verdade (ver src/app/login/page.tsx + CredentialsProvider em src/lib/auth.ts).
  const destination = process.env.NODE_ENV === "development" ? "/api/auth/auto-login" : "/login";
  const redirectUrl = new URL(destination, request.url);
  redirectUrl.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/projects/:path*"],
};
