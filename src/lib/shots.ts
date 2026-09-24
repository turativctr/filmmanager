import type { Shot, ShotSchedule } from "@prisma/client";

import { prisma } from "@/lib/prisma";

// Constantes e funções puras (sem dependência de prisma) moram em shots-shared.ts, pra poderem
// ser importadas direto em componentes cliente (ex.: shot-list-panel.tsx) sem puxar @prisma/client
// pro bundle do navegador. Re-exportamos tudo daqui pra manter a API pública deste módulo igual.
export * from "@/lib/shots-shared";

import {
  buildResetMinutesConfig,
  normalizeShotOrder,
  recomputeResetsForOrderedShots,
  resolveRodDaCena,
  type ResetMinutesConfig,
} from "@/lib/shots-shared";
import { paginasParaOitavos, resolveRodDaParte } from "@/lib/scene-parts-shared";
import { recalculateDayBlocks } from "@/lib/shootday-blocks";

const RESET_CONFIG_SELECT = {
  resetAjusteMin: true,
  resetTrocaLenteMin: true,
  resetTrocaCameraMin: true,
  resetPosicaoMin: true,
  resetCompletoMin: true,
} as const;

async function getResetMinutesConfig(projectId: string): Promise<ResetMinutesConfig> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: RESET_CONFIG_SELECT,
  });
  return buildResetMinutesConfig(project);
}

/** Recalcula tipoReset/tempoResetMin de todos os planos da cena (a ordem pode ter mudado) e
 *  sincroniza SceneShootDay.rodMin em toda diária onde a cena estiver agendada — chamado ao fim
 *  de toda rota de criação/edição/remoção/reordenação de Shot (PARTE 2 e 3). tempoResetMin grava o
 *  padrão do PROJETO pro tipo classificado (nível 1) — classifyReset() continua decidindo o TIPO
 *  sozinho, usando o ranking fixo de RESET_MINUTES só pra tie-break; a config do projeto nunca
 *  influencia qual tipo "ganha". tempoResetMinManual (nível 2, ajuste por plano) nunca é tocado
 *  aqui — só a rota de PATCH do Shot escreve nele. */
export async function recalculateScene(sceneId: string): Promise<Shot[]> {
  const found = await prisma.shot.findMany({ where: { sceneId }, orderBy: { ordem: "asc" } });
  if (found.length === 0) return [];

  // Coverage sempre logo abaixo do pai, em qualquer caminho que chegue aqui (criar, apagar,
  // vincular, reordenar) — ver normalizeShotOrder. Idempotente: se já está agrupado, não escreve.
  const shots = normalizeShotOrder(found);
  if (shots.some((shot, index) => shot.id !== found[index].id)) {
    await writeShotOrder(shots.map((s) => s.id));
  }

  const resetMinutes = await getResetMinutesConfig(shots[0].projectId);
  const resets = recomputeResetsForOrderedShots(shots);

  const updated = await prisma.$transaction(
    shots.map((shot) => {
      const result = resets.get(shot.id)!;
      return prisma.shot.update({
        where: { id: shot.id },
        data: { tipoReset: result.tipoReset, tempoResetMin: resetMinutes[result.tipoReset] },
      });
    })
  );

  if (updated.length > 0) {
    await syncSceneRodMin(sceneId, updated);
  }

  return updated;
}

/** Grava `ordem` 1..N na sequência dada. Duas fases (offset negativo, depois posição final) pra não
 *  colidir com a constraint única (sceneId, ordem) ao trocar planos de posição. */
export async function writeShotOrder(orderedIds: string[]): Promise<void> {
  await prisma.$transaction([
    ...orderedIds.map((id, index) => prisma.shot.update({ where: { id }, data: { ordem: -(index + 1) } })),
    ...orderedIds.map((id, index) => prisma.shot.update({ where: { id }, data: { ordem: index + 1 } })),
  ]);
}

/** Rod da cena em toda diária onde ela está agendada (SceneShootDay.rodMin), pela regra de
 *  resolveRodDaCena (alvo → soma dos planos → estimado pelos oitavos).
 *
 *  O terceiro caso (sem alvo e sem planos) só é aplicado com `semNadaVolta`, nas TRANSIÇÕES que
 *  levam a ele: apagar a duração alvo, apagar o último plano. Fora delas não mexe — esta função
 *  também roda via recalculateScene pra toda cena do projeto quando a config de resets muda, e aí
 *  zeraria o Rod que a AD digitou à mão no stripboard em toda cena sem planos.
 *
 *  Cena dividida: cada linha agendada recebe o Rod da SUA parte (resolveRodDaParte) — soma dos planos
 *  atribuídos a ela, ou o estimado proporcional aos oitavos (esse, de novo, só com `semNadaVolta`).
 *  A duração alvo não entra: em cena dividida ela é só referência do total. */
export async function syncSceneRodMin(
  sceneId: string,
  shots?: Shot[],
  { semNadaVolta = false }: { semNadaVolta?: boolean } = {}
): Promise<void> {
  const scene = await prisma.scene.findUniqueOrThrow({
    where: { id: sceneId },
    select: {
      duracaoAlvoMin: true,
      tempoEstimadoMin: true,
      paginas: true,
      parts: { select: { id: true, oitavos: true, sceneShootDay: { select: { id: true, rodDigitado: true } } } },
    },
  });
  const planos = shots ?? (await prisma.shot.findMany({ where: { sceneId } }));

  if (scene.parts.length > 0) {
    const oitavosCena = paginasParaOitavos(scene.paginas);
    const updates = scene.parts.flatMap((parte) => {
      if (!parte.sceneShootDay) return [];
      // Rod digitado pela AD manda sobre decupagem: a tela mostra "os planos somam X, você definiu
      // Y" (avisoDigitadoVsPlanos) e ela decide — o app não reescreve a escolha dela em silêncio.
      if (parte.sceneShootDay.rodDigitado) return [];
      const { rodMin, fonte } = resolveRodDaParte({
        parteId: parte.id,
        oitavosParte: parte.oitavos,
        oitavosCena,
        tempoEstimadoCenaMin: scene.tempoEstimadoMin,
        planos,
      });
      if (fonte !== "PLANOS" && !semNadaVolta) return [];
      return [prisma.sceneShootDay.update({ where: { id: parte.sceneShootDay.id }, data: { rodMin } })];
    });
    if (updates.length === 0) return;
    await prisma.$transaction(updates);
  } else {
    const { rodMin, fonte } = resolveRodDaCena({ duracaoAlvoMin: scene.duracaoAlvoMin, planos });
    if (fonte === "ESTIMADO" && !semNadaVolta) return;

    await prisma.sceneShootDay.updateMany({ where: { sceneId, rodDigitado: false }, data: { rodMin } });
  }

  // Rod mudou, então o cronograma daquela(s) diária(s) mudou — recalcula blocoManha/almoço de cada
  // uma delas (normalmente uma só, mas nada impede a mesma cena de estar agendada em mais de um dia).
  const days = await prisma.sceneShootDay.findMany({ where: { sceneId }, select: { shootDayId: true } });
  for (const day of days) {
    await recalculateDayBlocks(day.shootDayId);
  }
}

/** Recalcula tipoReset/tempoResetMin de todo ShotSchedule do dia (a ordem é global, cruza cenas) —
 *  chamado ao fim de toda rota de atribuição/remoção/reordenação de ShotSchedule. Diferente de
 *  recalculateScene: aqui o reset é entre planos consecutivos NO DIA, não na cena de origem, e o
 *  resultado é gravado em ShotSchedule (não em Shot). Mesma lógica de nível 1 acima: tempoResetMin
 *  grava o padrão do projeto pro tipo classificado; tempoResetMinManual nunca é tocado aqui. */
export async function recalculateDaySchedule(shootDayId: string): Promise<ShotSchedule[]> {
  const schedules = await prisma.shotSchedule.findMany({
    where: { shootDayId },
    orderBy: { ordem: "asc" },
    include: { shot: true },
  });
  if (schedules.length === 0) return [];

  const resetMinutes = await getResetMinutesConfig(schedules[0].projectId);
  const resets = recomputeResetsForOrderedShots(schedules.map((s) => ({ ...s.shot, id: s.id })));

  return prisma.$transaction(
    schedules.map((s) => {
      const result = resets.get(s.id)!;
      return prisma.shotSchedule.update({
        where: { id: s.id },
        data: { tipoReset: result.tipoReset, tempoResetMin: resetMinutes[result.tipoReset] },
      });
    })
  );
}

/** Recalcula tipoReset/tempoResetMin de TODAS as cenas e TODAS as diárias do projeto — chamado
 *  quando a configuração de tempos de reset do projeto (nível 1) muda, pra "calibrar uma vez"
 *  realmente refletir em todo plano já classificado, sem precisar tocar em cada um manualmente. */
export async function recalculateAllResetsForProject(projectId: string): Promise<void> {
  const scenes = await prisma.scene.findMany({ where: { projectId }, select: { id: true } });
  for (const scene of scenes) {
    await recalculateScene(scene.id);
  }

  const shootDays = await prisma.shootDay.findMany({ where: { projectId }, select: { id: true } });
  for (const day of shootDays) {
    await recalculateDaySchedule(day.id);
  }
}
