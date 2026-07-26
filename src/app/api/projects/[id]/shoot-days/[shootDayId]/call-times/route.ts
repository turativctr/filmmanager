import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { callTimesSchema } from "@/lib/validation/ordem-do-dia";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; shootDayId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const shootDay = await prisma.shootDay.findFirst({
    where: { id: params.shootDayId, projectId: params.id },
  });
  if (!shootDay) return NextResponse.json({ error: "Diária não encontrada." }, { status: 404 });

  const body = await request.json();
  const parsed = callTimesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.$transaction(
    parsed.data.callTimes.map((ct) =>
      prisma.characterCallTime.upsert({
        where: {
          characterId_shootDayId: { characterId: ct.characterId, shootDayId: shootDay.id },
        },
        create: {
          characterId: ct.characterId,
          shootDayId: shootDay.id,
          chamada: ct.chamada ?? null,
          camarim: ct.camarim ?? null,
          set: ct.set ?? null,
          saida: ct.saida ?? null,
        },
        update: {
          chamada: ct.chamada ?? null,
          camarim: ct.camarim ?? null,
          set: ct.set ?? null,
          saida: ct.saida ?? null,
        },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
