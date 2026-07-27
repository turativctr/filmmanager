import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { breakdownSchema } from "@/lib/validation/breakdown";

async function loadScene(projectId: string, sceneId: string) {
  return prisma.scene.findFirst({
    where: { id: sceneId, projectId },
    include: {
      cast: { include: { character: true } },
      breakdownSheet: true,
      extras: { include: { extra: true } },
    },
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

  const [allCharacters, allExtras] = await Promise.all([
    prisma.character.findMany({ where: { projectId: params.id }, orderBy: { idCurto: "asc" } }),
    prisma.extra.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "asc" } }),
  ]);

  return NextResponse.json({ scene, allCharacters, allExtras });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; sceneId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const scene = await prisma.scene.findFirst({ where: { id: params.sceneId, projectId: params.id } });
  if (!scene) return NextResponse.json({ error: "Cena não encontrada." }, { status: 404 });

  const body = await request.json();
  const parsed = breakdownSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { tempoEstimadoMin, characterIds, extraLinks, ...breakdownFields } = parsed.data;

  await prisma.$transaction(async (tx) => {
    if (tempoEstimadoMin !== undefined) {
      await tx.scene.update({ where: { id: scene.id }, data: { tempoEstimadoMin } });
    }

    if (characterIds) {
      await tx.sceneCast.deleteMany({ where: { sceneId: scene.id } });
      if (characterIds.length) {
        await tx.sceneCast.createMany({
          data: characterIds.map((characterId) => ({ sceneId: scene.id, characterId })),
        });
      }
    }

    if (extraLinks) {
      for (const { extraId, linked } of extraLinks) {
        if (linked) {
          await tx.extraScene.upsert({
            where: { extraId_sceneId: { extraId, sceneId: scene.id } },
            create: { extraId, sceneId: scene.id },
            update: {},
          });
        } else {
          await tx.extraScene.deleteMany({ where: { extraId, sceneId: scene.id } });
        }
      }
    }

    await tx.breakdownSheet.upsert({
      where: { sceneId: scene.id },
      create: { sceneId: scene.id, ...breakdownFields },
      update: breakdownFields,
    });
  });

  const updated = await loadScene(params.id, params.sceneId);
  return NextResponse.json({ scene: updated });
}
