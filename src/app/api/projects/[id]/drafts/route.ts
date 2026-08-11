import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { idCurtoFrom } from "@/lib/character-import";
import { collectSemFalaNames } from "@/lib/fdx-parser";
import type { FdxScene } from "@/lib/fdx-parser";
import { normalizeLocacaoNome } from "@/lib/locacao";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { revisionColorForDraftNumero } from "@/lib/revision-colors";
import { computeSchedulingImpacts, type ScheduledSceneInfo } from "@/lib/scheduling-impact";
import { computeSceneDiffs, type ExistingSceneForDiff } from "@/lib/script-diff";
import { scriptDraftConfirmSchema } from "@/lib/validation/script-draft";

// Ver o mesmo comentário em src/app/api/projects/route.ts — mesmo motivo, mesmo tipo de trabalho
// (aqui, aplicar o diff entre a versão salva e a recém-importada).
const PRISMA_TX_TIMEOUT_MS = 30_000;

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
  const typedScenes = scenes as FdxScene[];
  const newSceneByNumero = new Map(typedScenes.map((s) => [s.numero, s]));

  const result = await prisma.$transaction(
    async (tx) => {
      const lastDraft = await tx.scriptDraft.findFirst({
        where: { projectId: params.id },
        orderBy: { numero: "desc" },
      });
      const numero = (lastDraft?.numero ?? 0) + 1;
      const corRevisao = revisionColorForDraftNumero(numero);

      // Uma consulta só pra TODAS as cenas do projeto (não só as ativas) — o diff em si só compara
      // contra as ativas (uma cena omitida não deve ser "redescoberta como removida", nem comparar
      // campos contra um estado que não é mais o vigente — ver comentário em computeSceneDiffs),
      // mas o loop de escrita abaixo precisa saber se já existe uma LINHA (mesmo omitida) pra
      // decidir create vs. update — antes isso era um findUnique por diff.
      const allScenes = await tx.scene.findMany({
        where: { projectId: params.id },
        include: { cast: { include: { character: true } } },
      });
      const existingByNumero = new Map(allScenes.map((s) => [s.numero, s]));
      const existingForDiff: ExistingSceneForDiff[] = allScenes
        .filter((s) => !s.omitida)
        .map((s) => ({
          numero: s.numero,
          tipo: s.tipo,
          periodo: s.periodo,
          set: s.set,
          sinopse: s.sinopse,
          paginas: Number(s.paginas),
          personagens: s.cast.map((c) => c.character.personagem),
        }));

      const diffs = computeSceneDiffs(existingForDiff, typedScenes);

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

      // Igual ao raciocínio em import/fdx/confirm/route.ts: classifica ANTES de escrever, pra
      // fazer o trabalho por tabela em lote em vez de cena a cena (que antes chegava a ~4 idas ao
      // banco por diff — resolver personagens, buscar a cena existente, criar/atualizar,
      // apagar+recriar elenco — e estourava o timeout padrão de 5s da transação contra o Neon).
      const removidaNumeros = diffs.filter((d) => d.tipo === "REMOVIDA").map((d) => d.numero);
      if (removidaNumeros.length > 0) {
        await tx.scene.updateMany({
          where: { projectId: params.id, numero: { in: removidaNumeros } },
          data: { omitida: true },
        });
      }

      const writableDiffs = diffs.filter(
        (d): d is Extract<typeof d, { tipo: "ADICIONADA" | "MODIFICADA" }> => d.tipo !== "REMOVIDA"
      );
      const toCreate: FdxScene[] = [];
      const toUpdate: {
        scene: FdxScene;
        existingId: string;
        existingLocacaoId: string | null;
        paginasEditadoManualmente: boolean;
      }[] = [];
      for (const diff of writableDiffs) {
        const newScene = diff.tipo === "ADICIONADA" ? diff.scene : newSceneByNumero.get(diff.numero)!;
        const existing = existingByNumero.get(diff.numero);
        if (existing) {
          toUpdate.push({
            scene: newScene,
            existingId: existing.id,
            existingLocacaoId: existing.locacaoId,
            paginasEditadoManualmente: existing.paginasEditadoManualmente,
          });
        } else {
          toCreate.push(newScene);
        }
      }
      const scenesToProcess = [...toCreate, ...toUpdate.map((u) => u.scene)];
      const updateByNumero = new Map(toUpdate.map((u) => [u.scene.numero, u]));

      const existingCharacters = await tx.character.findMany({ where: { projectId: params.id } });
      const characterIdByName = new Map(existingCharacters.map((c) => [c.personagem.toUpperCase(), c.id]));
      const takenIdCurtos = new Set(existingCharacters.map((c) => c.idCurto));
      const newCharacterRows: Prisma.CharacterCreateManyInput[] = [];
      const semFalaNames = collectSemFalaNames(scenesToProcess);
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
          // Ver o mesmo comentário em import/fdx/confirm/route.ts — só pra personagem NOVO,
          // pra não desfazer correção manual do AD numa reimportação.
          newCharacterRows.push({
            id,
            projectId: params.id,
            idCurto,
            categoria: "PRINCIPAL",
            personagem: name,
            temFala: !semFalaNames.has(key),
          });
        }
      }
      if (newCharacterRows.length > 0) {
        await tx.character.createMany({ data: newCharacterRows });
      }

      // Nunca recria nem reponta locações já existentes — o trabalho de dividir/unificar que o AD
      // já fez não pode ser desfeito por uma reimportação. Prefere locacaoNome (o "LOCAL" antes do
      // ";" no cabeçalho — ver fdx-parser.ts) igual a import/fdx/confirm/route.ts; cai pro set só
      // pra cena sem locacaoNome (caso legado). Uma consulta por nome, uma por set, depois um
      // createMany só pras que faltam.
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
            omitida: false,
          };
        });
        await tx.scene.createMany({ data: rows });
      }

      // Dado por linha demais pra agrupar num createMany — continua update por update, mas sem
      // mais o findUnique nem o deleteMany individuais que existiam dentro deste loop antes.
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
            omitida: false,
          },
        });
      }

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
    },
    { timeout: PRISMA_TX_TIMEOUT_MS }
  );

  return NextResponse.json(result, { status: 201 });
}
