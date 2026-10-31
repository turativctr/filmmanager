/**
 * Lado servidor da estimativa com origem visível: a média do realizado DESTE projeto (estágio 2) e
 * o ponto de partida da produção (estágio 3). A regra pura está em src/lib/estimativa.ts.
 */
import {
  calcularMediaDoProjeto,
  type AmbienteCena,
  type CenaFilmada,
  type MediaDoProjeto,
  type OrigemTempo,
  type PartidaDoProjeto,
  resolverOrigemDoTempo,
} from "@/lib/estimativa";
import { prisma } from "@/lib/prisma";
import { duracaoRealizadaMin } from "@/lib/realizado";
import { paginasDaEntrada, paginasParaOitavos } from "@/lib/scene-parts-shared";

/** Média do realizado do projeto. Só entra cena COM início e fim lançados — previsto nunca se
 *  mistura com realizado. Abaixo de 2 diárias lançadas a média não existe (ver
 *  DIARIAS_MINIMAS_PARA_MEDIA): com uma diária só, a média é a daquele dia, não do projeto. */
export async function getMediaDoProjeto(projectId: string): Promise<MediaDoProjeto> {
  const linhas = await prisma.sceneShootDay.findMany({
    where: {
      shootDay: { projectId },
      horaInicioReal: { not: null },
      horaFimReal: { not: null },
    },
    select: {
      shootDayId: true,
      horaInicioReal: true,
      horaFimReal: true,
      scenePartId: true,
      scene: { select: { paginas: true, _count: { select: { shots: true } }, parts: { select: { id: true, oitavos: true } } } },
    },
  });

  const filmadas: CenaFilmada[] = linhas.flatMap((l) => {
    const realizadoMin = duracaoRealizadaMin(l.horaInicioReal, l.horaFimReal);
    if (realizadoMin == null || realizadoMin <= 0) return [];
    const parte = l.scenePartId ? l.scene.parts.find((p) => p.id === l.scenePartId) ?? null : null;
    return [
      {
        shootDayId: l.shootDayId,
        realizadoMin,
        oitavos: Math.round(paginasDaEntrada(Number(l.scene.paginas), parte) * 8),
        planos: l.scene._count.shots,
      },
    ];
  });

  return calcularMediaDoProjeto(filmadas);
}

/** Ponto de partida da produção. Os defaults do schema (5min por oitavo, +20% em exterior) valem
 *  pra todo projeto que nunca abriu a aba Jornada — mas o rótulo na tela diz "do projeto" mesmo
 *  assim, porque é onde a produção muda. */
export async function getPartidaDoProjeto(projectId: string): Promise<PartidaDoProjeto> {
  const projeto = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { minPorOitavoPartida: true, acrescimoExteriorPercent: true },
  });
  return {
    minPorOitavo: projeto.minPorOitavoPartida,
    acrescimoExteriorPercent: projeto.acrescimoExteriorPercent,
  };
}

/** Origem do tempo de uma linha agendada (cena ou parte numa diária).
 *
 *  `permitirPartida` NÃO tem default: é true onde um número precisa existir pra haver horário (o
 *  cronograma da diária) e false onde é melhor dizer "sem base pra estimar" do que mostrar um
 *  ponto de partida com cara de medição. Era exatamente o default silencioso que fazia "sem base"
 *  nunca aparecer. */
export function origemDoTempoDaLinha(entrada: {
  rodMin: number | null;
  rodDigitado: boolean;
  duracaoAlvoMin: number | null;
  planosMin: number | null;
  planos: number;
  /** Parte do total dos planos que é tempo de troca, com o ritmo do dia já aplicado. */
  resetsMin?: number;
  fatorResetPercent?: number;
  oitavos: number;
  ambiente: AmbienteCena;
  partida: PartidaDoProjeto;
  media: MediaDoProjeto | null;
  permitirPartida: boolean;
}): OrigemTempo {
  return resolverOrigemDoTempo({
    digitadoMin: entrada.rodDigitado ? entrada.rodMin : null,
    gravadoMin: entrada.rodDigitado ? null : entrada.rodMin,
    duracaoAlvoMin: entrada.duracaoAlvoMin,
    planosMin: entrada.planosMin,
    planos: entrada.planos,
    resetsMin: entrada.resetsMin,
    fatorResetPercent: entrada.fatorResetPercent,
    oitavos: entrada.oitavos,
    ambiente: entrada.ambiente,
    partida: entrada.partida,
    media: entrada.media,
    permitirPartida: entrada.permitirPartida,
  });
}

export { paginasParaOitavos };
