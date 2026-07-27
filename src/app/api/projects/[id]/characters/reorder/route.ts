import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";

const reorderSchema = z.object({ characterIds: z.array(z.string()).min(1) });

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const characters = await prisma.character.findMany({
    where: { projectId: params.id, id: { in: parsed.data.characterIds } },
    select: { id: true },
  });
  if (characters.length !== parsed.data.characterIds.length) {
    return NextResponse.json({ error: "Lista de personagens inválida." }, { status: 400 });
  }

  await prisma.$transaction(
    parsed.data.characterIds.map((characterId, index) =>
      prisma.character.update({ where: { id: characterId }, data: { numeroElenco: index + 1 } })
    )
  );

  return NextResponse.json({ ok: true });
}
