/**
 * Lado servidor da estimativa com origem visível: a média do realizado DESTE projeto (estágio 2) e
 * as faixas de ponto de partida da produção (estágio 3). A regra pura está em src/lib/estimativa.ts.
 */
import {
  calcularMediaDoProjeto,
  lerFaixas,
  resolverOrigemDoTempo,
  type CenaFilmada,
  type ClassificacaoCena,
  type FaixasTempo,
  type MediaDoProjeto,
  type OrigemTempo,
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

export async function getFaixasDoProjeto(projectId: string): Promise<FaixasTempo> {
  const projeto = await prisma.project.findUnique({ where: { id: projectId }, select: { faixasTempo: true } });
  return lerFaixas(projeto?.faixasTempo);
}

/** Origem do tempo de uma linha agendada (cena ou parte numa diária). `permitirConvencao` fica true
 *  onde um número PRECISA existir pra haver horário — o cronograma da diária —, e false onde é
 *  melhor dizer "sem base pra estimar" do que mostrar convenção com cara de medição. */
export function origemDoTempoDaLinha(entrada: {
  rodMin: number | null;
  rodDigitado: boolean;
  duracaoAlvoMin: number | null;
  planosMin: number | null;
  planos: number;
  oitavos: number;
  classificacao: ClassificacaoCena;
  faixas: FaixasTempo;
  media: MediaDoProjeto | null;
  permitirConvencao?: boolean;
}): OrigemTempo {
  return resolverOrigemDoTempo({
    digitadoMin: entrada.rodDigitado ? entrada.rodMin : null,
    gravadoMin: entrada.rodDigitado ? null : entrada.rodMin,
    duracaoAlvoMin: entrada.duracaoAlvoMin,
    planosMin: entrada.planosMin,
    planos: entrada.planos,
    oitavos: entrada.oitavos,
    classificacao: entrada.classificacao,
    faixas: entrada.faixas,
    media: entrada.media,
    permitirConvencao: entrada.permitirConvencao ?? true,
  });
}

export { paginasParaOitavos };
