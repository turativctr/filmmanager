import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { parsePaginas } from "@/lib/paginas";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { sceneSchema } from "@/lib/validation/scene";

async function loadScene(projectId: string, sceneId: string) {
  return prisma.scene.findFirst({
    where: { id: sceneId, projectId },
    include: { cast: { include: { character: true } } },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string; sceneId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const scene = await loadScene(params.id, params.sceneId);
  if (!scene) return NextResponse.json({ error: "Cena não encontrada." }, { status: 404 });

  return NextResponse.json(scene);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; sceneId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const scene = await loadScene(params.id, params.sceneId);
  if (!scene) return NextResponse.json({ error: "Cena não encontrada." }, { status: 404 });

  const body = await request.json();
  const parsed = sceneSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { characterIds, paginas, ...data } = parsed.data;

  if (data.numero !== scene.numero) {
    const duplicate = await prisma.scene.findFirst({
      where: { projectId: params.id, numero: data.numero, NOT: { id: scene.id } },
    });
    if (duplicate) {
      return NextResponse.json({ error: "Já existe uma cena com esse número." }, { status: 409 });
    }
  }

  const updated = await prisma.scene.update({
    where: { id: scene.id },
    data: {
      ...data,
      paginas: parsePaginas(paginas)!.toString(),
      ...(characterIds
        ? {
            cast: {
              deleteMany: {},
              create: characterIds.map((characterId) => ({ characterId })),
            },
          }
        : {}),
    },
    include: { cast: { include: { character: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; sceneId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const scene = await prisma.scene.findFirst({ where: { id: params.sceneId, projectId: params.id } });
  if (!scene) return NextResponse.json({ error: "Cena não encontrada." }, { status: 404 });

  await prisma.scene.delete({ where: { id: scene.id } });

  return NextResponse.json({ ok: true });
}
