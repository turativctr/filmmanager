import { encode } from "next-auth/jwt";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

/** App roda para um único usuário local — sem tela de login, a sessão é criada automaticamente aqui. */
const DEMO_EMAIL = "demo@filmmanager.local";

const SESSION_COOKIE_NAME = process.env.NEXTAUTH_URL?.startsWith("https://")
  ? "__Secure-next-auth.session-token"
  : "next-auth.session-token";

export async function GET(request: Request) {
  // Defesa em profundidade: mesmo com o middleware não apontando mais pra cá em produção
  // (ver src/middleware.ts), essa rota fica bloqueada por via das dúvidas contra acesso direto
  // por URL — logar qualquer visitante como demo sem senha nunca deve acontecer fora do dev local.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Não disponível em produção." }, { status: 404 });
  }

  const url = new URL(request.url);
  const callbackUrl = url.searchParams.get("callbackUrl") || "/projects";

  const user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (!user) {
    return NextResponse.json(
      { error: "Usuário demo não encontrado. Rode 'npm run db:seed'." },
      { status: 500 }
    );
  }

  const token = await encode({
    token: { id: user.id, sub: user.id, name: user.name, email: user.email, role: user.role, tema: user.tema },
    secret: process.env.NEXTAUTH_SECRET!,
  });

  const response = NextResponse.redirect(new URL(callbackUrl, url.origin));
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: url.protocol === "https:",
  });
  return response;
}
