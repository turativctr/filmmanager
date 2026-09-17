import { prisma } from "@/lib/prisma";
import { divisaoNaoFecha, paginasParaOitavos } from "@/lib/scene-parts-shared";

export * from "@/lib/scene-parts-shared";

export type ParteComDiaria = {
  id: string;
  rotulo: string;
  oitavos: number;
  ordem: number;
  shootDayId: string | null;
  numeroDia: number | null;
};

export type DivisaoDaCena = {
  oitavosCena: number;
  partes: ParteComDiaria[];
  naoFecha: boolean;
};

/** Partes da cena, na ordem, cada uma com a diária em que está (ou null). Cena sem divisão volta
 *  com `partes: []`. */
export async function getDivisaoDaCena(sceneId: string): Promise<DivisaoDaCena> {
  const scene = await prisma.scene.findUniqueOrThrow({
    where: { id: sceneId },
    select: {
      paginas: true,
      parts: {
        orderBy: { ordem: "asc" },
        include: { sceneShootDay: { select: { shootDayId: true, shootDay: { select: { numeroDia: true } } } } },
      },
    },
  });
  const oitavosCena = paginasParaOitavos(scene.paginas);
  const partes = scene.parts.map((p) => ({
    id: p.id,
    rotulo: p.rotulo,
    oitavos: p.oitavos,
    ordem: p.ordem,
    shootDayId: p.sceneShootDay?.shootDayId ?? null,
    numeroDia: p.sceneShootDay?.shootDay.numeroDia ?? null,
  }));
  return { oitavosCena, partes, naoFecha: divisaoNaoFecha(oitavosCena, partes) };
}
