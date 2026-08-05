import type { Shot, ShotSchedule } from "@prisma/client";

import { prisma } from "@/lib/prisma";

// Constantes e funções puras (sem dependência de prisma) moram em shots-shared.ts, pra poderem
// ser importadas direto em componentes cliente (ex.: shot-list-panel.tsx) sem puxar @prisma/client
// pro bundle do navegador. Re-exportamos tudo daqui pra manter a API pública deste módulo igual.
export * from "@/lib/shots-shared";

import {
  buildResetMinutesConfig,
  computeSceneShotTotals,
  recomputeResetsForOrderedShots,
  type ResetMinutesConfig,
} from "@/lib/shots-shared";
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
  const shots = await prisma.shot.findMany({ where: { sceneId }, orderBy: { ordem: "asc" } });
  if (shots.length === 0) return [];

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
    const { totalMin } = computeSceneShotTotals(updated);
    await prisma.sceneShootDay.updateMany({ where: { sceneId }, data: { rodMin: totalMin } });

    // Rod mudou, então o cronograma daquela(s) diária(s) mudou — recalcula blocoManha/almoço de cada
    // uma delas (normalmente uma só, mas nada impede a mesma cena de estar agendada em mais de um dia).
    const days = await prisma.sceneShootDay.findMany({ where: { sceneId }, select: { shootDayId: true } });
    for (const day of days) {
      await recalculateDayBlocks(day.shootDayId);
    }
  }

  return updated;
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
