import { compareLocacaoNome } from "@/lib/locacao";
import { naturalCompare } from "@/lib/natural-sort";
import { prisma } from "@/lib/prisma";

export type LocacaoListRow = {
  id: string;
  nome: string;
  endereco: string | null;
  numCenas: number;
  sceneNumeros: string[];
  numDiarias: number;
  numPontosApoio: number;
  sets: string[];
};

export async function getLocacoesListData(
  projectId: string,
  opts?: { semEndereco?: boolean }
): Promise<{ locacoes: LocacaoListRow[]; semLocacaoCount: number; semEnderecoCount: number }> {
  const [locacoes, semLocacaoCount, semEnderecoCount] = await Promise.all([
    prisma.locacao.findMany({
      where: { projectId, ...(opts?.semEndereco ? { endereco: null } : {}) },
      include: {
        scenes: { select: { numero: true, set: true, shootDays: { select: { shootDayId: true } } } },
        _count: { select: { pontosApoio: true } },
      },
    }),
    prisma.scene.count({ where: { projectId, locacaoId: null } }),
    prisma.locacao.count({ where: { projectId, endereco: null } }),
  ]);

  const result = locacoes.map((l) => {
    const sets = [...new Set(l.scenes.map((s) => s.set).filter((s): s is string => Boolean(s)))].sort(
      naturalCompare
    );
    const sceneNumeros = l.scenes.map((s) => s.numero).sort(naturalCompare);
    const diariaIds = new Set(l.scenes.flatMap((s) => s.shootDays.map((sd) => sd.shootDayId)));
    return {
      id: l.id,
      nome: l.nome,
      endereco: l.endereco,
      numCenas: l.scenes.length,
      sceneNumeros,
      numDiarias: diariaIds.size,
      numPontosApoio: l._count.pontosApoio,
      sets,
    };
  });

  result.sort((a, b) => compareLocacaoNome(a.nome, b.nome));

  return { locacoes: result, semLocacaoCount, semEnderecoCount };
}

export type LocacaoDetailSceneRow = {
  id: string;
  numero: string;
  tipo: "INT" | "EXT" | null;
  periodo: "DIA" | "NOITE" | "ENTARDECER" | "AMANHECER" | "CONTINUO" | "DEPOIS" | null;
  set: string | null;
  sinopse: string | null;
  numeroDia: number | null;
};

export async function getLocacaoDetailData(projectId: string, locacaoId: string) {
  const locacao = await prisma.locacao.findFirst({
    where: { id: locacaoId, projectId },
    include: {
      pontosApoio: { orderBy: { ordem: "asc" } },
      scenes: {
        include: { shootDays: { include: { shootDay: { select: { numeroDia: true } } } } },
      },
    },
  });
  if (!locacao) return null;

  const { scenes, ...locacaoFields } = locacao;
  const sceneRows: LocacaoDetailSceneRow[] = scenes
    .map((s) => ({
      id: s.id,
      numero: s.numero,
      tipo: s.tipo,
      periodo: s.periodo,
      set: s.set,
      sinopse: s.sinopse,
      numeroDia: s.shootDays[0]?.shootDay.numeroDia ?? null,
    }))
    .sort((a, b) => naturalCompare(a.numero, b.numero));

  return { ...locacaoFields, scenes: sceneRows };
}
