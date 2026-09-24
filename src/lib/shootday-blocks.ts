import { prisma } from "@/lib/prisma";
import {
  computeDerivedBlockTimes,
  minutesToTime,
  resolveEffectivePrepMin,
  resolveEffectiveRodMin,
  suggestAlmocoIndex,
  timeToMinutes,
} from "@/lib/schedule";
import { intercalar, scheduleDoBloco } from "@/lib/day-timeline";
import { tempoDeReferenciaMin } from "@/lib/estimativa";
import { paginasParaOitavos, tempoEstimadoDaEntrada } from "@/lib/scene-parts-shared";

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
        include: {
          scene: { select: { tempoEstimadoMin: true, paginas: true } },
          scenePart: { select: { oitavos: true } },
        },
      },
      blocos: true,
    },
  });
  if (!shootDay) return null;

  const allScenes = shootDay.scenes;
  // Parte de cena dividida: fallback do Rod é o estimado da parte, não o da cena inteira. Cena sem
  // tempo próprio usa a convenção calculada na leitura (tempoDeReferenciaMin) — o almoço precisa de
  // algum número pra ter onde cair.
  const tempoEstimado = (e: (typeof allScenes)[number]) =>
    tempoEstimadoDaEntrada(
      tempoDeReferenciaMin(e.scene.tempoEstimadoMin, paginasParaOitavos(e.scene.paginas)),
      paginasParaOitavos(e.scene.paginas),
      e.scenePart
    );
  const scheduleDaCena = (e: (typeof allScenes)[number]) => ({
    prepMin: resolveEffectivePrepMin(e.prepMin),
    rodMin: resolveEffectiveRodMin(e.rodMin, tempoEstimado(e)),
  });
  // Blocos de tempo (transporte etc.) ocupam horário como qualquer item da manhã — o almoço vem
  // depois deles também.
  const todos = intercalar(allScenes, shootDay.blocos);
  const neverSplit = todos.length > 0 && todos.every((i) => (i.tipo === "cena" ? i.cena.bloco : i.bloco.bloco) === "MANHA");
  let manha = todos.filter((i) => (i.tipo === "cena" ? i.cena.bloco : i.bloco.bloco) === "MANHA");

  if (neverSplit && allScenes.length > 0) {
    const blocoManhaInicio = shootDay.chamadaGeral
      ? minutesToTime(timeToMinutes(shootDay.chamadaGeral) + shootDay.project.preparacaoInicialMin)
      : null;
    const items = todos.map((i) => (i.tipo === "cena" ? scheduleDaCena(i.cena) : scheduleDoBloco(i.bloco)));
    const boundary = suggestAlmocoIndex(shootDay.chamadaGeral, blocoManhaInicio, items, shootDay.project.limiteAlmocoMin);

    if (boundary < todos.length) {
      const depois = todos.slice(boundary);
      const cenaIds = depois.flatMap((i) => (i.tipo === "cena" ? [i.cena.id] : []));
      const blocoIds = depois.flatMap((i) => (i.tipo === "bloco" ? [i.bloco.id] : []));
      await prisma.$transaction([
        prisma.sceneShootDay.updateMany({ where: { id: { in: cenaIds } }, data: { bloco: "TARDE" } }),
        prisma.shootDayBlock.updateMany({ where: { id: { in: blocoIds } }, data: { bloco: "TARDE" } }),
      ]);
      manha = todos.slice(0, boundary);
    }
  }

  const manhaItems = manha.map((i) => (i.tipo === "cena" ? scheduleDaCena(i.cena) : scheduleDoBloco(i.bloco)));

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
