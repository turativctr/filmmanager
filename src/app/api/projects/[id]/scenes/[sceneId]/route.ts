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

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
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

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
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

  // Edição manual de paginas/tempoEstimadoMin — igual ao padrão de
  // SceneShootDay.observacoesAutoGeradas: uma vez editado à mão, a reimportação de um novo draft
  // (import/fdx/confirm, drafts) passa a preservar os três campos em vez de recalcular por cima.
  // `linhas` (a contagem bruta por trás de `paginas`) vira null porque deixa de corresponder ao
  // valor editado.
  const newPaginas = parsePaginas(paginas)!;
  const paginasChanged = newPaginas !== Number(scene.paginas);
  const tempoChanged = data.tempoEstimadoMin !== undefined && data.tempoEstimadoMin !== scene.tempoEstimadoMin;

  const updated = await prisma.scene.update({
    where: { id: scene.id },
    data: {
      ...data,
      paginas: newPaginas.toString(),
      ...(paginasChanged || tempoChanged ? { paginasEditadoManualmente: true, linhas: null } : {}),
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

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const scene = await prisma.scene.findFirst({ where: { id: params.sceneId, projectId: params.id } });
  if (!scene) return NextResponse.json({ error: "Cena não encontrada." }, { status: 404 });

  await prisma.scene.delete({ where: { id: scene.id } });

  return NextResponse.json({ ok: true });
}
