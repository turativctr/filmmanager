import { CHARACTER_CATEGORIA_ORDER } from "@/lib/character-categoria";
import { computeDood, type DoodCharacterInput, type DoodExtraInput } from "@/lib/dood";
import { prisma } from "@/lib/prisma";

export async function getProjectDoodData(projectId: string) {
  const [project, shootDays, characters, extras] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { titulo: true, sigla: true, equipeTecnica: true, sistemaIdElenco: true },
    }),
    prisma.shootDay.findMany({
      where: { projectId },
      orderBy: { data: "asc" },
      select: {
        id: true,
        numeroDia: true,
        data: true,
        blocoManhaInicio: true,
        almocoInicio: true,
      },
    }),
    prisma.character.findMany({
      where: { projectId },
      orderBy: { idCurto: "asc" },
      include: {
        scenes: { include: { scene: { include: { shootDays: { select: { shootDayId: true } } } } } },
        callTimes: true,
      },
    }),
    prisma.extra.findMany({
      where: { projectId },
      include: { cenas: { include: { scene: { include: { shootDays: { select: { shootDayId: true } } } } } } },
    }),
  ]);

  const doodShootDays = shootDays.map((day) => ({
    id: day.id,
    numeroDia: day.numeroDia,
    data: day.data.toISOString(),
    blocoManhaInicio: day.blocoManhaInicio,
    almocoInicio: day.almocoInicio,
  }));

  // PRINCIPAL primeiro, depois COADJUVANTE etc. — mesma ordem em que aparecem na página do DOOD e no export XLSX.
  const sortedCharacters = [...characters].sort(
    (a, b) =>
      CHARACTER_CATEGORIA_ORDER.indexOf(a.categoria) - CHARACTER_CATEGORIA_ORDER.indexOf(b.categoria) ||
      a.idCurto.localeCompare(b.idCurto)
  );

  const doodCharacters: DoodCharacterInput[] = sortedCharacters.map((character) => ({
    id: character.id,
    idCurto: character.idCurto,
    numeroElenco: character.numeroElenco,
    personagem: character.personagem,
    workingShootDayIds: [
      ...new Set(character.scenes.flatMap((sc) => sc.scene.shootDays.map((s) => s.shootDayId))),
    ],
    callTimes: Object.fromEntries(
      character.callTimes.map((ct) => [ct.shootDayId, { chamada: ct.chamada, saida: ct.saida }])
    ),
  }));

  const doodExtras: DoodExtraInput[] = extras.map((extra) => ({
    id: extra.id,
    personagem: extra.personagem,
    quantidade: extra.quantidade,
    workingShootDayIds: [
      ...new Set(extra.cenas.flatMap((ec) => ec.scene.shootDays.map((s) => s.shootDayId))),
    ],
  }));

  const dood = computeDood(doodShootDays, doodCharacters, doodExtras, project?.equipeTecnica ?? 0);

  return {
    project,
    shootDays,
    ...dood,
  };
}
