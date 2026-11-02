import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // O nome do cookie (com ou sem prefixo __Secure-) sai do protocolo da requisição, que é o mesmo
  // critério do login. O padrão do getToken olha o NEXTAUTH_URL: se ele não começar com https://,
  // o middleware procura o cookie errado e devolve todo login para /login.
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: request.nextUrl.protocol === "https:",
  });
  if (request.nextUrl.searchParams.has("__diag")) {
    const decode = (secureCookie: boolean) =>
      getToken({ req: request, secret: process.env.NEXTAUTH_SECRET, secureCookie }).then(
        (t) => !!t,
        (e) => `erro: ${e instanceof Error ? e.message : String(e)}`,
      );
    return NextResponse.json({
      protocol: request.nextUrl.protocol,
      cookieNames: request.cookies.getAll().map((c) => c.name),
      hasSecret: !!process.env.NEXTAUTH_SECRET,
      nextauthUrlHttps: process.env.NEXTAUTH_URL?.startsWith("https://") ?? null,
      vercel: !!process.env.VERCEL,
      tokenSecure: await decode(true),
      tokenPlain: await decode(false),
    });
  }
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
