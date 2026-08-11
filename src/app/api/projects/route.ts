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
import { revisionColorForDraftNumero } from "@/lib/revision-colors";
import { onboardingCreateSchema } from "@/lib/validation/onboarding";

// Teto folgado pra transação interativa de criação de projeto+cenas — o padrão do Prisma (5s) foi
// desenhado pra transações pequenas, mas um roteiro com muitas cenas pode não caber nisso mesmo já
// com o trabalho em lote abaixo (ex.: latência de rede alta até o Neon num pico de carga). Ver
// PRISMA_TX_TIMEOUT_MS: também usado em import/fdx/confirm/route.ts, que faz o mesmo tipo de
// trabalho pra um projeto já existente.
const PRISMA_TX_TIMEOUT_MS = 30_000;

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

  const project = await prisma.$transaction(
    async (tx) => {
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
        const typedScenes = scenes as FdxScene[];

        // Criar cena a cena (um create() por linha, cada um com um nested `cast: {create}` por
        // personagem) fazia um roteiro de 15 cenas passar de 40 idas ao banco em série — é isso
        // que estourava o timeout padrão de 5s da transação contra o Neon (latência de rede por
        // chamada). Daqui pra baixo, cada tabela é escrita numa única chamada em lote.
        //
        // Projeto novo, sem personagem/locação prévia — nenhuma consulta de "já existe" é
        // necessária (diferente de import/fdx/confirm/route.ts, que reimporta num projeto já
        // existente). Os ids são gerados aqui mesmo (em vez de deixar o banco gerar e depois
        // reconsultar) só pra poder montar os vínculos de elenco sem uma segunda ida ao banco pra
        // descobrir quem é quem.
        const characterIdByName = new Map<string, string>();
        const takenIdCurtos = new Set<string>();
        const characterRows: Prisma.CharacterCreateManyInput[] = [];
        const semFalaNames = collectSemFalaNames(typedScenes);
        for (const scene of typedScenes) {
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
            // Nunca infere a categoria a partir do roteiro — sempre entra como PRINCIPAL, o
            // usuário ajusta depois na página de Elenco se necessário. `temFala` SIM é inferido:
            // vem direto da detecção do parser (ver collectSemFalaNames), não é um palpite.
            characterRows.push({
              id,
              projectId: created.id,
              idCurto,
              categoria: "PRINCIPAL",
              personagem: name,
              temFala: !semFalaNames.has(key),
            });
          }
        }
        if (characterRows.length > 0) {
          await tx.character.createMany({ data: characterRows });
        }

        // Locações: agrupadas por locacaoNome — o "LOCAL" antes do ";" no cabeçalho ("LOCAL; SET",
        // ver fdx-parser.ts), que é o que agrupa vários `set` distintos numa MESMA Locacao (ex.:
        // "CASA; COZINHA" e "CASA; QUARTO" compartilham a Locacao "CASA"). Sem locacaoNome
        // (cabeçalho sem ";"), cai pro set — locação e set têm o mesmo nome, igual ao
        // comportamento de sempre. Sem endereço (preenchimento manual, feito depois em /locacoes).
        const nomeToLocacaoId = new Map<string, string>();
        const locacaoRows: Prisma.LocacaoCreateManyInput[] = [];
        for (const scene of typedScenes) {
          const nome = scene.locacaoNome ?? scene.set;
          if (!nome) continue;
          const key = normalizeLocacaoNome(nome);
          if (nomeToLocacaoId.has(key)) continue;
          const id = randomUUID();
          nomeToLocacaoId.set(key, id);
          locacaoRows.push({ id, projectId: created.id, nome: normalizeLocacaoNome(nome) });
        }
        if (locacaoRows.length > 0) {
          await tx.locacao.createMany({ data: locacaoRows });
        }

        // Cenas: uma linha por cena, um único createMany.
        const sceneIdByNumero = new Map<string, string>();
        const sceneRows: Prisma.SceneCreateManyInput[] = typedScenes.map((scene) => {
          const id = randomUUID();
          sceneIdByNumero.set(scene.numero, id);
          return {
            id,
            numero: scene.numero,
            projectId: created.id,
            tipo: scene.tipo,
            periodo: scene.periodo,
            periodoFim: scene.periodoFim,
            classeLuz: scene.classeLuz,
            set: scene.set,
            locacaoId: (() => {
              const nome = scene.locacaoNome ?? scene.set;
              return nome ? nomeToLocacaoId.get(normalizeLocacaoNome(nome)) ?? null : null;
            })(),
            sinopse: scene.sinopse,
            paginas: scene.paginas.toString(),
            linhas: scene.linhas,
            tempoEstimadoMin: scene.tempoEstimadoMinSugerido,
          };
        });
        await tx.scene.createMany({ data: sceneRows });

        // Vínculos cena–personagem: um createMany pra todos de uma vez, no lugar do `cast:
        // {create}` aninhado por cena que existia antes (cada item aninhado era outra ida ao
        // banco).
        const sceneCastRows: Prisma.SceneCastCreateManyInput[] = [];
        for (const scene of typedScenes) {
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
    },
    { timeout: PRISMA_TX_TIMEOUT_MS }
  );

  return NextResponse.json(project, { status: 201 });
}
