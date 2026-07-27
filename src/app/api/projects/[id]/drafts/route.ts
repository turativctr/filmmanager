import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { resolveCharacterId } from "@/lib/character-import";
import type { FdxScene } from "@/lib/fdx-parser";
import { resolveLocacaoIdForSet } from "@/lib/locacao-import";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { revisionColorForDraftNumero } from "@/lib/revision-colors";
import { computeSchedulingImpacts, type ScheduledSceneInfo } from "@/lib/scheduling-impact";
import { computeSceneDiffs, type ExistingSceneForDiff } from "@/lib/script-diff";
import { scriptDraftConfirmSchema } from "@/lib/validation/script-draft";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const drafts = await prisma.scriptDraft.findMany({
    where: { projectId: params.id },
    orderBy: { numero: "desc" },
    include: { _count: { select: { sceneDiffs: true } } },
  });

  return NextResponse.json(drafts);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = scriptDraftConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { scenes, numeroDraft, dataDraft, arquivoNome } = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    const lastDraft = await tx.scriptDraft.findFirst({
      where: { projectId: params.id },
      orderBy: { numero: "desc" },
    });
    const numero = (lastDraft?.numero ?? 0) + 1;
    const corRevisao = revisionColorForDraftNumero(numero);

    const activeScenes = await tx.scene.findMany({
      where: { projectId: params.id, omitida: false },
      include: { cast: { include: { character: true } } },
    });
    const existingForDiff: ExistingSceneForDiff[] = activeScenes.map((s) => ({
      numero: s.numero,
      tipo: s.tipo,
      periodo: s.periodo,
      set: s.set,
      sinopse: s.sinopse,
      paginas: Number(s.paginas),
      personagens: s.cast.map((c) => c.character.personagem),
    }));

    const diffs = computeSceneDiffs(existingForDiff, scenes as FdxScene[]);

    const draft = await tx.scriptDraft.create({
      data: { projectId: params.id, numero, corRevisao, numeroDraft, dataDraft, arquivoNome },
    });

    if (diffs.length > 0) {
      await tx.sceneDiff.createMany({
        data: diffs.map((d) => ({
          scriptDraftId: draft.id,
          sceneNumero: d.numero,
          tipo: d.tipo,
          camposAlterados: d.tipo === "MODIFICADA" ? (d.camposAlterados as Prisma.InputJsonValue) : undefined,
        })),
      });
    }

    const existingCharacters = await tx.character.findMany({ where: { projectId: params.id } });
    const characterIdByName = new Map(existingCharacters.map((c) => [c.personagem.toUpperCase(), c.id]));
    const takenIdCurtos = new Set(existingCharacters.map((c) => c.idCurto));
    // Nunca recria nem reponta locações já existentes — o trabalho de dividir/unificar que o AD já
    // fez não pode ser desfeito por uma reimportação (ver resolveLocacaoIdForSet).
    const setToLocacaoId = new Map<string, string>();

    for (const diff of diffs) {
      if (diff.tipo === "REMOVIDA") {
        await tx.scene.update({
          where: { projectId_numero: { projectId: params.id, numero: diff.numero } },
          data: { omitida: true },
        });
        continue;
      }

      const newScene = diff.tipo === "ADICIONADA" ? diff.scene : scenes.find((s) => s.numero === diff.numero)!;

      const characterIds: string[] = [];
      for (const name of newScene.personagens) {
        const characterId = await resolveCharacterId(tx, params.id, name, true, characterIdByName, takenIdCurtos);
        if (characterId) characterIds.push(characterId);
      }

      const existingRow = await tx.scene.findUnique({
        where: { projectId_numero: { projectId: params.id, numero: diff.numero } },
      });

      // Cena já existente com locação já atribuída (pode ter sido "separada" manualmente pro AD)
      // preserva — só resolve por set pra cena nova ou pra uma que ainda não tinha locação.
      const locacaoId =
        existingRow?.locacaoId ?? (await resolveLocacaoIdForSet(tx, params.id, newScene.set, setToLocacaoId));

      const sceneData = {
        tipo: newScene.tipo,
        periodo: newScene.periodo,
        set: newScene.set,
        locacaoId,
        sinopse: newScene.sinopse,
        paginas: newScene.paginas.toString(),
        tempoEstimadoMin: newScene.tempoEstimadoMinSugerido,
        omitida: false,
      };

      if (existingRow) {
        await tx.sceneCast.deleteMany({ where: { sceneId: existingRow.id } });
        await tx.scene.update({
          where: { id: existingRow.id },
          data: {
            ...sceneData,
            cast: characterIds.length ? { create: characterIds.map((characterId) => ({ characterId })) } : undefined,
          },
        });
      } else {
        await tx.scene.create({
          data: {
            ...sceneData,
            numero: diff.numero,
            projectId: params.id,
            cast: characterIds.length ? { create: characterIds.map((characterId) => ({ characterId })) } : undefined,
          },
        });
      }
    }

    const affectedNumeros = diffs.filter((d) => d.tipo !== "ADICIONADA").map((d) => d.numero);
    const scheduledRows =
      affectedNumeros.length > 0
        ? await tx.sceneShootDay.findMany({
            where: { scene: { projectId: params.id, numero: { in: affectedNumeros } } },
            include: { scene: { select: { numero: true } }, shootDay: { select: { id: true, numeroDia: true } } },
          })
        : [];
    const scheduledScenes: ScheduledSceneInfo[] = scheduledRows.map((r) => ({
      numero: r.scene.numero,
      shootDayId: r.shootDay.id,
      numeroDia: r.shootDay.numeroDia,
    }));

    const impacts = computeSchedulingImpacts(diffs, scheduledScenes);

    return { draft, diffs, impacts };
  });

  return NextResponse.json(result, { status: 201 });
}
