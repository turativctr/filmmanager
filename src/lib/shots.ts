import type { Shot, ShotSchedule } from "@prisma/client";

import { prisma } from "@/lib/prisma";

// Constantes e funções puras (sem dependência de prisma) moram em shots-shared.ts, pra poderem
// ser importadas direto em componentes cliente (ex.: shot-list-panel.tsx) sem puxar @prisma/client
// pro bundle do navegador. Re-exportamos tudo daqui pra manter a API pública deste módulo igual.
export * from "@/lib/shots-shared";

import { computeSceneShotTotals, recomputeResetsForOrderedShots } from "@/lib/shots-shared";

/** Recalcula tipoReset/tempoResetMin de todos os planos da cena (a ordem pode ter mudado) e
 *  sincroniza SceneShootDay.rodMin em toda diária onde a cena estiver agendada — chamado ao fim
 *  de toda rota de criação/edição/remoção/reordenação de Shot (PARTE 2 e 3). */
export async function recalculateScene(sceneId: string): Promise<Shot[]> {
  const shots = await prisma.shot.findMany({ where: { sceneId }, orderBy: { ordem: "asc" } });
  const resets = recomputeResetsForOrderedShots(shots);

  const updated = await prisma.$transaction(
    shots.map((shot) => {
      const result = resets.get(shot.id)!;
      return prisma.shot.update({
        where: { id: shot.id },
        data: { tipoReset: result.tipoReset, tempoResetMin: result.tempoResetMin },
      });
    })
  );

  if (updated.length > 0) {
    const { totalMin } = computeSceneShotTotals(updated);
    await prisma.sceneShootDay.updateMany({ where: { sceneId }, data: { rodMin: totalMin } });
  }

  return updated;
}

/** Recalcula tipoReset/tempoResetMin de todo ShotSchedule do dia (a ordem é global, cruza cenas) —
 *  chamado ao fim de toda rota de atribuição/remoção/reordenação de ShotSchedule. Diferente de
 *  recalculateScene: aqui o reset é entre planos consecutivos NO DIA, não na cena de origem, e o
 *  resultado é gravado em ShotSchedule (não em Shot). */
export async function recalculateDaySchedule(shootDayId: string): Promise<ShotSchedule[]> {
  const schedules = await prisma.shotSchedule.findMany({
    where: { shootDayId },
    orderBy: { ordem: "asc" },
    include: { shot: true },
  });

  const resets = recomputeResetsForOrderedShots(schedules.map((s) => ({ ...s.shot, id: s.id })));

  return prisma.$transaction(
    schedules.map((s) => {
      const result = resets.get(s.id)!;
      return prisma.shotSchedule.update({
        where: { id: s.id },
        data: { tipoReset: result.tipoReset, tempoResetMin: result.tempoResetMin },
      });
    })
  );
}
