import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { resolveCharacterId } from "@/lib/character-import";
import type { FdxScene } from "@/lib/fdx-parser";
import { resolveLocacaoIdByNome, resolveLocacaoIdForSet } from "@/lib/locacao-import";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { fdxImportConfirmSchema } from "@/lib/validation/fdx-import";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = fdxImportConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { scenes, substituirExistentes, criarPersonagens } = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    const existingScenes = await tx.scene.findMany({ where: { projectId: params.id } });
    const sceneByNumero = new Map(existingScenes.map((s) => [s.numero, s]));

    const existingCharacters = await tx.character.findMany({ where: { projectId: params.id } });
    const characterIdByName = new Map(
      existingCharacters.map((c) => [c.personagem.toUpperCase(), c.id])
    );
    const takenIdCurtos = new Set(existingCharacters.map((c) => c.idCurto));

    let created = 0;
    let updated = 0;
    let skipped = 0;
    // Nunca recria nem reponta locações já existentes — se o set já tem uma locação vinculada (de
    // um import anterior), reusa a mesma; só cria locação nova pra set genuinamente novo. O trabalho
    // de dividir/unificar que o AD já fez não pode ser desfeito por uma reimportação.
    const setToLocacaoId = new Map<string, string>();
    const nomeToLocacaoId = new Map<string, string>();

    for (const scene of scenes as FdxScene[]) {
      const existing = sceneByNumero.get(scene.numero);
      if (existing && !substituirExistentes) {
        skipped += 1;
        continue;
      }

      const characterIds: string[] = [];
      for (const name of scene.personagens) {
        const characterId = await resolveCharacterId(
          tx,
          params.id,
          name,
          criarPersonagens,
          characterIdByName,
          takenIdCurtos
        );
        if (characterId) characterIds.push(characterId);
      }

      // Cena já existente com locação já atribuída: preserva (pode ter sido "separada" manualmente
      // pro AD pra uma locação diferente da que o set sugeriria) — só resolve por set pra cena nova
      // ou pra uma existente que ainda não tinha locação nenhuma.
      const locacaoId =
        existing?.locacaoId ??
        (scene.locacaoNome
          ? await resolveLocacaoIdByNome(tx, params.id, scene.locacaoNome, nomeToLocacaoId)
          : await resolveLocacaoIdForSet(tx, params.id, scene.set, setToLocacaoId));

      const sceneData = {
        tipo: scene.tipo,
        periodo: scene.periodo,
        set: scene.set,
        locacaoId,
        sinopse: scene.sinopse,
        paginas: scene.paginas.toString(),
        tempoEstimadoMin: scene.tempoEstimadoMinSugerido,
      };

      if (existing) {
        await tx.sceneCast.deleteMany({ where: { sceneId: existing.id } });
        await tx.scene.update({
          where: { id: existing.id },
          data: {
            ...sceneData,
            cast: characterIds.length
              ? { create: characterIds.map((characterId) => ({ characterId })) }
              : undefined,
          },
        });
        updated += 1;
      } else {
        await tx.scene.create({
          data: {
            ...sceneData,
            numero: scene.numero,
            projectId: params.id,
            cast: characterIds.length
              ? { create: characterIds.map((characterId) => ({ characterId })) }
              : undefined,
          },
        });
        created += 1;
      }
    }

    return { created, updated, skipped };
  });

  return NextResponse.json(result);
}
