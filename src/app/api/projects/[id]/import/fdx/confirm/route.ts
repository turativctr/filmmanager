import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { idCurtoFrom } from "@/lib/character-import";
import type { FdxScene } from "@/lib/fdx-parser";
import { normalizeLocacaoNome } from "@/lib/locacao";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { fdxImportConfirmSchema } from "@/lib/validation/fdx-import";

// Ver o mesmo comentário em src/app/api/projects/route.ts — mesmo motivo, mesmo tipo de trabalho,
// só que num projeto já existente (que pode já ter cenas/personagens/locações a reaproveitar).
const PRISMA_TX_TIMEOUT_MS = 30_000;

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
  const typedScenes = scenes as FdxScene[];

  const result = await prisma.$transaction(
    async (tx) => {
      const existingScenes = await tx.scene.findMany({ where: { projectId: params.id } });
      const sceneByNumero = new Map(existingScenes.map((s) => [s.numero, s]));

      const existingCharacters = await tx.character.findMany({ where: { projectId: params.id } });
      const characterIdByName = new Map(existingCharacters.map((c) => [c.personagem.toUpperCase(), c.id]));
      const takenIdCurtos = new Set(existingCharacters.map((c) => c.idCurto));

      // Classifica ANTES de escrever nada — o resto do trabalho (personagens, locações, cenas,
      // vínculos) sai desse array em lote, não mais cena a cena. Antes, cada cena fazia até ~4
      // idas ao banco em série (resolver personagens, resolver locação, criar/atualizar a cena,
      // apagar+recriar o elenco); num roteiro de 15 cenas isso já passava de 40 chamadas contra o
      // Neon e estourava o timeout padrão de 5s da transação.
      let skipped = 0;
      const toCreate: FdxScene[] = [];
      const toUpdate: {
        scene: FdxScene;
        existingId: string;
        existingLocacaoId: string | null;
        paginasEditadoManualmente: boolean;
      }[] = [];
      for (const scene of typedScenes) {
        const existing = sceneByNumero.get(scene.numero);
        if (existing && !substituirExistentes) {
          skipped += 1;
          continue;
        }
        if (existing) {
          toUpdate.push({
            scene,
            existingId: existing.id,
            existingLocacaoId: existing.locacaoId,
            paginasEditadoManualmente: existing.paginasEditadoManualmente,
          });
        } else {
          toCreate.push(scene);
        }
      }
      const updateByNumero = new Map(toUpdate.map((u) => [u.scene.numero, u]));
      const scenesToProcess = [...toCreate, ...toUpdate.map((u) => u.scene)];

      // Personagens novos: um createMany pra quem ainda não existe (nem no banco, nem já decidido
      // neste mesmo lote) — os já existentes continuam vindo do characterIdByName montado acima.
      const newCharacterRows: Prisma.CharacterCreateManyInput[] = [];
      if (criarPersonagens) {
        for (const scene of scenesToProcess) {
          for (const name of scene.personagens) {
            const key = name.toUpperCase();
            if (characterIdByName.has(key)) continue;
            let idCurto = idCurtoFrom(name);
            let suffix = 2;
            while (takenIdCurtos.has(idCurto)) {
              idCurto = `${idCurtoFrom(name)}${suffix}`;
              suffix += 1;
            }
            takenIdCurtos.add(idCurto);
            const id = randomUUID();
            characterIdByName.set(key, id);
            newCharacterRows.push({ id, projectId: params.id, idCurto, categoria: "PRINCIPAL", personagem: name });
          }
        }
        if (newCharacterRows.length > 0) {
          await tx.character.createMany({ data: newCharacterRows });
        }
      }

      // Locações: nunca recria nem reponta uma já existente — se o set (ou, pra PDF, o nome da
      // locação) já tem uma locação vinculada de um import anterior, reusa a mesma; só cria nova
      // pra quem é genuinamente novo. O trabalho de dividir/unificar que o AD já fez não pode ser
      // desfeito por uma reimportação. Antes, essa checagem era um findFirst por cena; agora são
      // no máximo duas consultas (uma por nome, uma por set) pra todo o lote.
      const nomeToLocacaoId = new Map<string, string>();
      const setToLocacaoId = new Map<string, string>();
      const neededByNome = new Set<string>();
      const neededBySet = new Set<string>();
      for (const scene of scenesToProcess) {
        if (updateByNumero.get(scene.numero)?.existingLocacaoId) continue;
        if (scene.locacaoNome) neededByNome.add(normalizeLocacaoNome(scene.locacaoNome));
        else if (scene.set) neededBySet.add(scene.set);
      }
      if (neededByNome.size > 0) {
        const found = await tx.locacao.findMany({
          where: { projectId: params.id, nome: { in: [...neededByNome] } },
        });
        for (const l of found) nomeToLocacaoId.set(l.nome, l.id);
      }
      if (neededBySet.size > 0) {
        const found = await tx.scene.findMany({
          where: { projectId: params.id, set: { in: [...neededBySet] }, locacaoId: { not: null } },
          select: { set: true, locacaoId: true },
        });
        for (const s of found) {
          if (s.set && s.locacaoId && !setToLocacaoId.has(s.set)) setToLocacaoId.set(s.set, s.locacaoId);
        }
      }
      const newLocacaoRows: Prisma.LocacaoCreateManyInput[] = [];
      for (const nome of neededByNome) {
        if (nomeToLocacaoId.has(nome)) continue;
        const id = randomUUID();
        nomeToLocacaoId.set(nome, id);
        newLocacaoRows.push({ id, projectId: params.id, nome });
      }
      for (const set of neededBySet) {
        if (setToLocacaoId.has(set)) continue;
        const id = randomUUID();
        setToLocacaoId.set(set, id);
        newLocacaoRows.push({ id, projectId: params.id, nome: normalizeLocacaoNome(set) });
      }
      if (newLocacaoRows.length > 0) {
        await tx.locacao.createMany({ data: newLocacaoRows });
      }

      function resolveLocacaoId(scene: FdxScene, existingLocacaoId: string | null): string | null {
        if (existingLocacaoId) return existingLocacaoId;
        if (scene.locacaoNome) return nomeToLocacaoId.get(normalizeLocacaoNome(scene.locacaoNome)) ?? null;
        if (scene.set) return setToLocacaoId.get(scene.set) ?? null;
        return null;
      }

      // Cenas novas: um único createMany.
      const sceneIdByNumero = new Map<string, string>();
      if (toCreate.length > 0) {
        const rows: Prisma.SceneCreateManyInput[] = toCreate.map((scene) => {
          const id = randomUUID();
          sceneIdByNumero.set(scene.numero, id);
          return {
            id,
            numero: scene.numero,
            projectId: params.id,
            tipo: scene.tipo,
            periodo: scene.periodo,
            periodoFim: scene.periodoFim,
            classeLuz: scene.classeLuz,
            set: scene.set,
            locacaoId: resolveLocacaoId(scene, null),
            sinopse: scene.sinopse,
            paginas: scene.paginas.toString(),
            linhas: scene.linhas,
            tempoEstimadoMin: scene.tempoEstimadoMinSugerido,
          };
        });
        await tx.scene.createMany({ data: rows });
      }

      // Cenas existentes: dado por linha é diferente demais pra agrupar num createMany, então
      // isso continua update por update — mas o apaga+recria do elenco (antes um deleteMany por
      // cena, dentro deste mesmo loop) foi tirado daqui e batched abaixo, junto com o das cenas
      // novas.
      for (const { scene, existingId, existingLocacaoId, paginasEditadoManualmente } of toUpdate) {
        sceneIdByNumero.set(scene.numero, existingId);
        await tx.scene.update({
          where: { id: existingId },
          data: {
            tipo: scene.tipo,
            periodo: scene.periodo,
            periodoFim: scene.periodoFim,
            classeLuz: scene.classeLuz,
            set: scene.set,
            locacaoId: resolveLocacaoId(scene, existingLocacaoId),
            sinopse: scene.sinopse,
            // Nunca sobrescreve oitavos/tempo/linhas de uma cena editada manualmente — a
            // reimportação atualiza os outros campos normalmente, só esses três ficam intocados.
            ...(paginasEditadoManualmente
              ? {}
              : {
                  paginas: scene.paginas.toString(),
                  linhas: scene.linhas,
                  tempoEstimadoMin: scene.tempoEstimadoMinSugerido,
                }),
          },
        });
      }

      // Vínculos cena–personagem: um deleteMany cobrindo todas as cenas atualizadas (em vez de um
      // por cena) e um único createMany pro elenco de cenas novas + atualizadas juntas.
      if (toUpdate.length > 0) {
        await tx.sceneCast.deleteMany({ where: { sceneId: { in: toUpdate.map((u) => u.existingId) } } });
      }
      const sceneCastRows: Prisma.SceneCastCreateManyInput[] = [];
      for (const scene of scenesToProcess) {
        const sceneId = sceneIdByNumero.get(scene.numero);
        if (!sceneId) continue;
        for (const name of scene.personagens) {
          const characterId = characterIdByName.get(name.toUpperCase());
          if (characterId) sceneCastRows.push({ sceneId, characterId });
        }
      }
      if (sceneCastRows.length > 0) {
        await tx.sceneCast.createMany({ data: sceneCastRows });
      }

      return { created: toCreate.length, updated: toUpdate.length, skipped };
    },
    { timeout: PRISMA_TX_TIMEOUT_MS }
  );

  return NextResponse.json(result);
}
