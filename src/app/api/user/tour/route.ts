import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { tourConcluido: true },
  });

  return NextResponse.json({ ok: true });
}
