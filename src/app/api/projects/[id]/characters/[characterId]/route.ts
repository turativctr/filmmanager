import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { characterSchema } from "@/lib/validation/character";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; characterId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const character = await prisma.character.findFirst({
    where: { id: params.characterId, projectId: params.id },
  });
  if (!character) return NextResponse.json({ error: "Personagem não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = characterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { sceneIds, ...data } = parsed.data;

  if (data.idCurto !== character.idCurto) {
    const duplicate = await prisma.character.findFirst({
      where: { projectId: params.id, idCurto: data.idCurto, NOT: { id: character.id } },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "Já existe um personagem com esse ID curto." },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.character.update({
    where: { id: character.id },
    data: {
      ...data,
      ...(sceneIds
        ? { scenes: { deleteMany: {}, create: sceneIds.map((sceneId) => ({ sceneId })) } }
        : {}),
    },
    include: { scenes: { include: { scene: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; characterId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const character = await prisma.character.findFirst({
    where: { id: params.characterId, projectId: params.id },
  });
  if (!character) return NextResponse.json({ error: "Personagem não encontrado." }, { status: 404 });

  await prisma.character.delete({ where: { id: character.id } });

  return NextResponse.json({ ok: true });
}
