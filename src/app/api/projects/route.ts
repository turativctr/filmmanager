import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { resolveCharacterId } from "@/lib/character-import";
import type { FdxScene } from "@/lib/fdx-parser";
import { prisma } from "@/lib/prisma";
import { revisionColorForDraftNumero } from "@/lib/revision-colors";
import { onboardingCreateSchema } from "@/lib/validation/onboarding";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  // ADMIN enxerga todo projeto, inclusive órfãos (ownerId null) — USER continua restrito aos próprios.
  const isAdmin = session.user.role === "ADMIN";
  const projects = await prisma.project.findMany({
    where: isAdmin ? {} : { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { scenes: true, shootDays: true } } },
  });

  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await request.json();
  const parsed = onboardingCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { projeto, scenes, arquivoNome } = parsed.data;

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        titulo: projeto.titulo,
        diretor: projeto.diretor,
        producao: projeto.producao,
        dataInicio: projeto.dataInicio ? new Date(projeto.dataInicio) : undefined,
        dataFim: projeto.dataFim ? new Date(projeto.dataFim) : undefined,
        roteiristas: projeto.roteiristas,
        numeroDraft: projeto.numeroDraft,
        dataDraft: projeto.dataDraft,
        contatoProducao: projeto.contatoProducao,
        ownerId: session.user.id,
      },
    });

    if (scenes.length > 0) {
      const characterIdByName = new Map<string, string>();
      const takenIdCurtos = new Set<string>();

      for (const scene of scenes as FdxScene[]) {
        const characterIds: string[] = [];
        for (const name of scene.personagens) {
          const characterId = await resolveCharacterId(
            tx,
            created.id,
            name,
            true,
            characterIdByName,
            takenIdCurtos
          );
          if (characterId) characterIds.push(characterId);
        }

        await tx.scene.create({
          data: {
            numero: scene.numero,
            projectId: created.id,
            tipo: scene.tipo,
            periodo: scene.periodo,
            set: scene.set,
            locacao: scene.set,
            sinopse: scene.sinopse,
            paginas: scene.paginas.toString(),
            tempoEstimadoMin: scene.tempoEstimadoMinSugerido,
            cast: characterIds.length ? { create: characterIds.map((characterId) => ({ characterId })) } : undefined,
          },
        });
      }

      // Draft 1/Branco é a linha de base — sem SceneDiff, pois não há "antes" pra comparar.
      // Isso garante que a primeira reimportação via a aba Drafts vire corretamente Draft 2/Azul.
      await tx.scriptDraft.create({
        data: {
          projectId: created.id,
          numero: 1,
          corRevisao: revisionColorForDraftNumero(1),
          numeroDraft: projeto.numeroDraft,
          dataDraft: projeto.dataDraft,
          arquivoNome,
        },
      });
    }

    return created;
  });

  return NextResponse.json(project, { status: 201 });
}
