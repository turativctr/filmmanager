import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TEMA_VALUES, THEME_COOKIE_MAX_AGE, THEME_COOKIE_NAME } from "@/lib/theme";

const themeSchema = z.object({ tema: z.enum(TEMA_VALUES) });

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = themeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { tema: parsed.data.tema },
  });

  const res = NextResponse.json({ tema: parsed.data.tema });
  res.cookies.set(THEME_COOKIE_NAME, parsed.data.tema, {
    path: "/",
    maxAge: THEME_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
  return res;
}
