import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { parsePaginas } from "@/lib/paginas";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { sceneSchema } from "@/lib/validation/scene";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const scenes = await prisma.scene.findMany({
    where: { projectId: params.id },
    include: { cast: { include: { character: true } } },
  });

  return NextResponse.json(scenes);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = sceneSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { characterIds, paginas, ...data } = parsed.data;

  const existing = await prisma.scene.findFirst({
    where: { projectId: params.id, numero: data.numero },
  });
  if (existing) {
    return NextResponse.json({ error: "Já existe uma cena com esse número." }, { status: 409 });
  }

  const scene = await prisma.scene.create({
    data: {
      ...data,
      paginas: parsePaginas(paginas)!.toString(),
      projectId: params.id,
      cast: characterIds?.length
        ? { create: characterIds.map((characterId) => ({ characterId })) }
        : undefined,
    },
    include: { cast: { include: { character: true } } },
  });

  return NextResponse.json(scene, { status: 201 });
}
