import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { characterSchema } from "@/lib/validation/character";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const characters = await prisma.character.findMany({
    where: { projectId: params.id },
    include: { scenes: { include: { scene: true } } },
    orderBy: { idCurto: "asc" },
  });

  return NextResponse.json(characters);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = characterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { sceneIds, ...data } = parsed.data;

  const existing = await prisma.character.findFirst({
    where: { projectId: params.id, idCurto: data.idCurto },
  });
  if (existing) {
    return NextResponse.json({ error: "Já existe um personagem com esse ID curto." }, { status: 409 });
  }

  const { _max } = await prisma.character.aggregate({
    where: { projectId: params.id },
    _max: { numeroElenco: true },
  });
  const numeroElenco = (_max.numeroElenco ?? 0) + 1;

  const character = await prisma.character.create({
    data: {
      ...data,
      projectId: params.id,
      numeroElenco,
      scenes: sceneIds?.length ? { create: sceneIds.map((sceneId) => ({ sceneId })) } : undefined,
    },
    include: { scenes: { include: { scene: true } } },
  });

  return NextResponse.json(character, { status: 201 });
}
