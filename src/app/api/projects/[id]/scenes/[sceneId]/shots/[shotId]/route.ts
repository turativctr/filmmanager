import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { recalculateScene, syncSceneRodMin, writeShotOrder } from "@/lib/shots";
import { computeTempoTotal, coverageShotNumero, nextFreeShotNumero, normalizeShotOrder } from "@/lib/shots-shared";
import { shotPatchSchema } from "@/lib/validation/shot";

import type { Shot } from "@prisma/client";

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

/** Posição de um grupo (plano + coverages) na ordem plana — [início, fim) — pra mover o grupo
 *  inteiro de uma vez. */
function groupRange(ordered: Shot[], parentId: string): [number, number] {
  const start = ordered.findIndex((s) => s.id === parentId);
  let end = start + 1;
  while (end < ordered.length && ordered[end].planoPaiId === parentId) end++;
  return [start, end];
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; sceneId: string; shotId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const shot = await prisma.shot.findFirst({
    where: { id: params.shotId, sceneId: params.sceneId, scene: { projectId: params.id } },
  });
  if (!shot) return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = shotPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { ehMaster, planoPaiId, ...fields } = parsed.data;

  const sceneShots = normalizeShotOrder(
    await prisma.shot.findMany({ where: { sceneId: shot.sceneId }, orderBy: { ordem: "asc" } })
  );
  const hasCoverages = sceneShots.some((s) => s.planoPaiId === shot.id);
  const outrosNumeros = sceneShots.filter((s) => s.id !== shot.id).map((s) => s.numero);

  // Estado de hierarquia DEPOIS desta requisição — as validações olham pra ele, não pro de antes,
  // pra que "vincular e desmarcar master" numa mesma chamada funcione.
  const nextPaiId = planoPaiId === undefined ? shot.planoPaiId : planoPaiId;
  const nextMaster = ehMaster === undefined ? shot.ehMaster : ehMaster;

  const hierarchyData: { planoPaiId?: string | null; numero?: string; ehMaster?: boolean } = {};
  let nextOrder: string[] | null = null;

  if (planoPaiId !== undefined && planoPaiId !== shot.planoPaiId) {
    if (planoPaiId === null) {
      // Desvincular: volta pra lista plana com o próximo número livre (o "6B" não faz mais sentido
      // solto). A posição é a de onde estava — normalizeShotOrder o coloca logo abaixo do grupo do
      // antigo pai, já que coverage não pode ficar no meio do grupo de outro plano.
      hierarchyData.planoPaiId = null;
      hierarchyData.numero = nextFreeShotNumero(outrosNumeros);
    } else {
      const parent = sceneShots.find((s) => s.id === planoPaiId);
      if (!parent) return badRequest("O plano pai precisa ser um plano desta mesma cena.");
      if (parent.id === shot.id) return badRequest("Um plano não pode ser coverage de si mesmo.");
      // Um nível só, nos dois sentidos: nem pendurar em quem já é coverage, nem pendurar um plano
      // que já tem coverages (os filhos dele ficariam com dois níveis).
      if (parent.planoPaiId) return badRequest("Coverage não pode ter coverage: esse plano já é coverage de outro.");
      if (hasCoverages) return badRequest("Esse plano tem coverages próprios e não pode virar coverage de outro.");

      hierarchyData.planoPaiId = parent.id;
      hierarchyData.numero = coverageShotNumero(parent.numero, outrosNumeros);

      // Entra no fim do grupo do pai.
      const withoutSelf = sceneShots.filter((s) => s.id !== shot.id);
      const [, end] = groupRange(withoutSelf, parent.id);
      nextOrder = [...withoutSelf.slice(0, end).map((s) => s.id), shot.id, ...withoutSelf.slice(end).map((s) => s.id)];
    }
  }

  // Master é o plano principal da cena, no topo — um coverage não pode ser isso (moraria no topo e
  // debaixo do pai ao mesmo tempo). Valida contra o estado final.
  if (nextMaster && nextPaiId) {
    return badRequest("Um coverage não pode ser master. Desvincule o plano antes de marcar como master.");
  }

  const tornandoMaster = ehMaster === true && !shot.ehMaster;
  if (ehMaster !== undefined && ehMaster !== shot.ehMaster) {
    hierarchyData.ehMaster = ehMaster;
  }
  if (tornandoMaster) {
    // Sobe pro topo UMA vez, levando os coverages junto. Depois disso a AD arrasta à vontade: nada
    // força o master a continuar lá.
    const [start, end] = groupRange(sceneShots, shot.id);
    const grupo = sceneShots.slice(start, end);
    nextOrder = [...grupo, ...sceneShots.slice(0, start), ...sceneShots.slice(end)].map((s) => s.id);
  }

  const takesPrevistos = fields.takesPrevistos ?? shot.takesPrevistos;
  const duracaoTakeMin = fields.duracaoTakeMin ?? shot.duracaoTakeMin;
  const tempoSetupMin = fields.tempoSetupMin ?? shot.tempoSetupMin;

  await prisma.$transaction([
    // Um master por cena: marcar este desmarca qualquer outro.
    ...(tornandoMaster
      ? [
          prisma.shot.updateMany({
            where: { sceneId: shot.sceneId, ehMaster: true, id: { not: shot.id } },
            data: { ehMaster: false },
          }),
        ]
      : []),
    prisma.shot.update({
      where: { id: shot.id },
      data: {
        ...fields,
        ...hierarchyData,
        tempoTotalMin: computeTempoTotal(takesPrevistos, duracaoTakeMin, tempoSetupMin),
      },
    }),
  ]);

  if (nextOrder) await writeShotOrder(nextOrder);

  const shots = await recalculateScene(shot.sceneId);

  return NextResponse.json(shots);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; sceneId: string; shotId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const shot = await prisma.shot.findFirst({
    where: { id: params.shotId, sceneId: params.sceneId, scene: { projectId: params.id } },
  });
  if (!shot) return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });

  // Apagar o pai solta os coverages — é um desvincular, então cada um recebe o próximo número livre
  // (o schema faria SetNull sozinho, mas deixaria "6A" solto numa cena sem plano 6). Ficam na
  // posição onde estavam.
  const sceneShots = await prisma.shot.findMany({ where: { sceneId: shot.sceneId }, orderBy: { ordem: "asc" } });
  const coverages = sceneShots.filter((s) => s.planoPaiId === shot.id);
  // O número do plano apagado ENTRA na conta: sem ele, apagar o 7 com coverage 7A daria "7" ao 7A —
  // o mesmo número de um plano que pode já estar em claquete.
  const numeros = sceneShots.filter((s) => s.planoPaiId !== shot.id).map((s) => s.numero);
  const renumerar = coverages.map((coverage) => {
    const numero = nextFreeShotNumero(numeros);
    numeros.push(numero);
    return prisma.shot.update({ where: { id: coverage.id }, data: { planoPaiId: null, numero } });
  });

  await prisma.$transaction([...renumerar, prisma.shot.delete({ where: { id: shot.id } })]);

  const shots = await recalculateScene(shot.sceneId);
  // Apagou o último plano: recalculateScene não tem o que somar e não mexe no Rod — que ficaria
  // com a soma antiga (a cena 14A do demo ficou com 6min em vez dos 90 estimados). Sem planos, o
  // Rod volta à duração alvo, se houver, senão ao tempo estimado pelos oitavos.
  if (shots.length === 0) await syncSceneRodMin(shot.sceneId, [], { semNadaVolta: true });

  return NextResponse.json(shots);
}
