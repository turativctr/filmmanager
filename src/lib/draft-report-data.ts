import type { SistemaIdElenco } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { computeSchedulingImpacts, type DiffLike, type SchedulingImpact, type ScheduledSceneInfo } from "@/lib/scheduling-impact";
import type { FieldChange } from "@/lib/script-diff";

export type DraftDiffRow = {
  numero: string;
  tipo: "ADICIONADA" | "REMOVIDA" | "MODIFICADA";
  camposAlterados: Record<string, FieldChange> | null;
  // snapshot ATUAL da cena (não histórico) — null só pra REMOVIDA, ou se a cena não existir mais
  scene: {
    tipo: string | null;
    periodo: string | null;
    set: string | null;
    locacao: string | null;
    sinopse: string | null;
    paginas: number;
    cast: { idCurto: string; numeroElenco: number | null; personagem: string }[];
  } | null;
};

export type ScriptDraftDetail = {
  project: {
    id: string;
    titulo: string;
    sigla: string | null;
    diretor: string | null;
    producao: string | null;
    sistemaIdElenco: SistemaIdElenco;
  };
  draft: { id: string; numero: number; corRevisao: string; numeroDraft: string | null; dataDraft: string | null; importedAt: Date };
  diffs: DraftDiffRow[];
  impacts: SchedulingImpact[];
};

export async function getScriptDraftDetail(projectId: string, draftId: string): Promise<ScriptDraftDetail | null> {
  const draft = await prisma.scriptDraft.findFirst({
    where: { id: draftId, projectId },
    include: {
      sceneDiffs: { orderBy: { sceneNumero: "asc" } },
      project: { select: { id: true, titulo: true, sigla: true, diretor: true, producao: true, sistemaIdElenco: true } },
    },
  });
  if (!draft) return null;

  const numeros = draft.sceneDiffs.map((d) => d.sceneNumero);
  const scenes =
    numeros.length > 0
      ? await prisma.scene.findMany({
          where: { projectId, numero: { in: numeros } },
          include: { cast: { include: { character: true } } },
        })
      : [];
  const sceneByNumero = new Map(scenes.map((s) => [s.numero, s]));

  const diffs: DraftDiffRow[] = draft.sceneDiffs.map((d) => {
    const scene = sceneByNumero.get(d.sceneNumero);
    return {
      numero: d.sceneNumero,
      tipo: d.tipo,
      camposAlterados: d.tipo === "MODIFICADA" ? (d.camposAlterados as Record<string, FieldChange>) : null,
      scene:
        d.tipo === "REMOVIDA" || !scene
          ? null
          : {
              tipo: scene.tipo,
              periodo: scene.periodo,
              set: scene.set,
              locacao: scene.locacao,
              sinopse: scene.sinopse,
              paginas: Number(scene.paginas),
              cast: scene.cast.map((c) => ({
                idCurto: c.character.idCurto,
                numeroElenco: c.character.numeroElenco,
                personagem: c.character.personagem,
              })),
            },
    };
  });

  const diffLikes: DiffLike[] = draft.sceneDiffs.map((d) =>
    d.tipo === "MODIFICADA"
      ? { tipo: "MODIFICADA", numero: d.sceneNumero, camposAlterados: d.camposAlterados as Record<string, FieldChange> }
      : { tipo: d.tipo, numero: d.sceneNumero }
  );

  const affectedNumeros = draft.sceneDiffs.filter((d) => d.tipo !== "ADICIONADA").map((d) => d.sceneNumero);
  const scheduledRows =
    affectedNumeros.length > 0
      ? await prisma.sceneShootDay.findMany({
          where: { scene: { projectId, numero: { in: affectedNumeros } } },
          include: { scene: { select: { numero: true } }, shootDay: { select: { id: true, numeroDia: true } } },
        })
      : [];
  const scheduledScenes: ScheduledSceneInfo[] = scheduledRows.map((r) => ({
    numero: r.scene.numero,
    shootDayId: r.shootDay.id,
    numeroDia: r.shootDay.numeroDia,
  }));

  const impacts = computeSchedulingImpacts(diffLikes, scheduledScenes);

  return {
    project: draft.project,
    draft: {
      id: draft.id,
      numero: draft.numero,
      corRevisao: draft.corRevisao,
      numeroDraft: draft.numeroDraft,
      dataDraft: draft.dataDraft,
      importedAt: draft.importedAt,
    },
    diffs,
    impacts,
  };
}
