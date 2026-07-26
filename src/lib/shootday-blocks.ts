import { prisma } from "@/lib/prisma";
import {
  computeDerivedBlockTimes,
  minutesToTime,
  resolveEffectivePrepMin,
  resolveEffectiveRodMin,
  suggestAlmocoIndex,
  timeToMinutes,
} from "@/lib/schedule";

/** Recalcula e persiste blocoManhaInicio/almocoInicio/almocoFim/blocoTardeInicio de uma diária a
 *  partir de chamadaGeral + Jornada do projeto (limiteAlmocoMin/duracaoAlmocoMin/preparacaoInicialMin)
 *  + tempo acumulado das cenas do bloco MANHA — chamado ao fim de toda rota que pode mudar a ordem/
 *  bloco das cenas ou a chamada geral da diária (reorder do Stripboard, PATCH da diária, PATCH da
 *  Jornada do projeto, recalculateScene). O bloco/almoço nunca é editado diretamente: é sempre
 *  consequência de onde o marcador de almoço está no Stripboard, nunca um valor declarado pelo AD.
 *
 *  Se a diária ainda nunca foi dividida manualmente (todas as cenas em bloco MANHA — o default do
 *  schema), posiciona o marcador automaticamente no último corte de cena antes do limite configurado,
 *  gravando bloco=TARDE nas cenas a partir daí. Isso só acontece enquanto a diária estiver "intocada":
 *  o primeiro drag manual do marcador cria uma mistura MANHA/TARDE que desativa esse reposicionamento
 *  automático pra sempre (ver getStripboardBoard, que usa a mesma checagem pra sugerir a mesma posição
 *  na tela antes mesmo de qualquer gravação, no primeiro carregamento). */
export async function recalculateDayBlocks(shootDayId: string) {
  const shootDay = await prisma.shootDay.findUnique({
    where: { id: shootDayId },
    include: {
      project: { select: { limiteAlmocoMin: true, duracaoAlmocoMin: true, preparacaoInicialMin: true } },
      scenes: {
        orderBy: { ordem: "asc" },
        include: { scene: { select: { tempoEstimadoMin: true } } },
      },
    },
  });
  if (!shootDay) return null;

  const allScenes = shootDay.scenes;
  const neverSplit = allScenes.length > 0 && allScenes.every((e) => e.bloco === "MANHA");
  let manhaEntries = allScenes.filter((e) => e.bloco === "MANHA");

  if (neverSplit) {
    const blocoManhaInicio = shootDay.chamadaGeral
      ? minutesToTime(timeToMinutes(shootDay.chamadaGeral) + shootDay.project.preparacaoInicialMin)
      : null;
    const items = allScenes.map((e) => ({
      prepMin: resolveEffectivePrepMin(e.prepMin),
      rodMin: resolveEffectiveRodMin(e.rodMin, e.scene.tempoEstimadoMin),
    }));
    const boundary = suggestAlmocoIndex(shootDay.chamadaGeral, blocoManhaInicio, items, shootDay.project.limiteAlmocoMin);

    if (boundary < allScenes.length) {
      const tardeIds = allScenes.slice(boundary).map((e) => e.id);
      await prisma.sceneShootDay.updateMany({ where: { id: { in: tardeIds } }, data: { bloco: "TARDE" } });
      manhaEntries = allScenes.slice(0, boundary);
    }
  }

  const manhaItems = manhaEntries.map((entry) => ({
    prepMin: resolveEffectivePrepMin(entry.prepMin),
    rodMin: resolveEffectiveRodMin(entry.rodMin, entry.scene.tempoEstimadoMin),
  }));

  const derived = computeDerivedBlockTimes(shootDay.chamadaGeral, manhaItems, shootDay.project);

  return prisma.shootDay.update({ where: { id: shootDayId }, data: derived });
}

/** Recalcula todas as diárias de um projeto — chamado quando a Jornada (limiteAlmocoMin/
 *  duracaoAlmocoMin/preparacaoInicialMin) muda no PATCH do projeto, já que afeta o cálculo de toda
 *  diária dele, não só a que estava sendo editada. */
export async function recalculateAllDayBlocksForProject(projectId: string): Promise<void> {
  const days = await prisma.shootDay.findMany({ where: { projectId }, select: { id: true } });
  for (const day of days) {
    await recalculateDayBlocks(day.id);
  }
}
