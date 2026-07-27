import { notFound } from "next/navigation";

import type { LocacaoInfo } from "@/components/ordem-do-dia/types";
import { OrdemDoDiaWizard } from "@/components/ordem-do-dia/wizard";
import { getCharacterId } from "@/lib/character-id";
import {
  aggregateComidaCena,
  aggregateFigurino,
  aggregateHabilidades,
  aggregateMake,
  aggregateMicrofones,
  aggregateObjetos,
  aggregateObservacoesDoDia,
  aggregatePosProducao,
  aggregateTrilha,
  computeCastAutoSchedule,
  computeShotScheduleAlerts,
  consolidateNotes,
  defaultChamadaEquipe,
  detectContinuidadeAlerts,
  detectQuickChanges,
  formatCharacterAggregation,
  formatMakeSceneLabel,
  totalScenesByCharacter,
} from "@/lib/ordem-do-dia";
import { CREW_CALL_DEPARTMENTS } from "@/lib/report-constants";
import { getShootDayReportData } from "@/lib/report-data";
import { prisma } from "@/lib/prisma";

export default async function OrdemDoDiaPage({
  params,
  searchParams,
}: {
  params: { id: string; shootDayId: string };
  searchParams: { step?: string };
}) {
  const data = await getShootDayReportData(params.id, params.shootDayId);
  if (!data) notFound();

  const characters = data.castPresente.map((c) => ({
    id: c.id,
    idCurto: c.idCurto,
    numeroElenco: c.numeroElenco,
    personagem: c.personagem,
  }));
  const totals = totalScenesByCharacter(data.scenes);
  const totalFor = (idCurto: string) => {
    const character = characters.find((c) => c.idCurto === idCurto);
    return character ? (totals.get(character.id) ?? 0) : 0;
  };

  const autoSchedule = computeCastAutoSchedule(data.scenes);
  const castRows = data.castPresente.map((c) => {
    const auto = autoSchedule.get(c.id);
    return {
      id: c.id,
      idCurto: getCharacterId(c, data.project),
      personagem: c.personagem,
      ator: c.ator,
      cenas: data.scenes.filter((s) => s.cast.some((sc) => sc.id === c.id)).map((s) => s.numero),
      chamada: c.chamada ?? auto?.chamada ?? null,
      camarim: c.camarim ?? auto?.camarim ?? null,
      set: c.set ?? auto?.set ?? null,
      saida: c.saida ?? auto?.saida ?? null,
      autoChamada: auto?.chamada ?? null,
      autoCamarim: auto?.camarim ?? null,
      autoSet: auto?.set ?? null,
      autoSaida: auto?.saida ?? null,
    };
  });

  const extraRows = data.extrasPresente.map((e) => ({
    ...e,
    chamada: e.chamada || data.shootDay.chamadaGeral,
  }));

  const sceneTimeRows = data.scenes.map((s) => ({
    sceneId: s.sceneId,
    bloco: s.bloco,
    ordem: s.ordem,
    numero: s.numero,
    setLocacaoDisplay: s.setLocacaoDisplay,
    set: s.set,
    locacao: s.locacao,
    sinopse: s.sinopse,
    sinopseAD: s.sinopseAD,
    tempoEstimadoMin: s.tempoEstimadoMin,
    prepMin: s.prepMin,
    rodMin: s.rodMin,
    shots: s.shots,
    shotsTotal: s.shotsTotal,
  }));

  const distinctLocacaoIds = [...new Set(data.scenes.map((s) => s.locacaoId).filter((id): id is string => id != null))];

  let locacaoInfo: LocacaoInfo = { locacao: null, mixedCount: null };
  if (distinctLocacaoIds.length === 1) {
    const locacao = await prisma.locacao.findUnique({
      where: { id: distinctLocacaoIds[0] },
      include: { pontosApoio: { orderBy: { ordem: "asc" } } },
    });
    if (locacao) {
      locacaoInfo = {
        locacao: {
          nome: locacao.nome,
          endereco: locacao.endereco,
          hospitalNome: locacao.hospitalNome,
          hospitalEndereco: locacao.hospitalEndereco,
          hospitalTelefone: locacao.hospitalTelefone,
          pontosApoio: locacao.pontosApoio.map((p) => ({
            id: p.id,
            tipo: p.tipo,
            descricao: p.descricao,
            endereco: p.endereco,
          })),
        },
        mixedCount: null,
      };
    }
  } else if (distinctLocacaoIds.length > 1) {
    locacaoInfo = { locacao: null, mixedCount: distinctLocacaoIds.length };
  }

  const initialStep = Math.min(4, Math.max(1, Number(searchParams.step) || 1));

  const existingChamadaEquipe: Record<string, string> = {};
  // A rota já devolve chamadaEquipeList com os valores salvos (ou null); usamos os defaults automáticos
  // apenas para departamentos ainda sem valor salvo.
  const autoChamadaEquipe = defaultChamadaEquipe(data.shootDay.chamadaGeral);
  for (const { departamento, horario } of data.chamadaEquipeList) {
    if (horario) existingChamadaEquipe[departamento] = horario;
  }
  const chamadaEquipeInicial = Object.fromEntries(
    CREW_CALL_DEPARTMENTS.map((dept) => [dept, existingChamadaEquipe[dept] ?? autoChamadaEquipe[dept] ?? ""])
  );

  const figurinoAgg = aggregateFigurino(data.scenes, characters);
  const habilidadesAgg = aggregateHabilidades(data.scenes, characters);
  const makeEntries = aggregateMake(data.scenes, characters);
  const { criticos: objetosCriticos, normais: objetosNormais } = aggregateObjetos(data.scenes);
  const comidaCena = aggregateComidaCena(data.scenes);
  const notes = consolidateNotes(data.scenes);
  const posProducao = aggregatePosProducao(data.scenes);
  const trilha = aggregateTrilha(data.scenes, characters);
  const microfones = aggregateMicrofones(data.scenes, characters);
  const quickChanges = detectQuickChanges(data.scenes, characters);
  const continuidadeAlerts = detectContinuidadeAlerts(data.scenes);
  const { resumptionAlerts, pendingGapAlerts } = computeShotScheduleAlerts(data.shotSchedule, data.scenes);
  const observacoesPorCena = aggregateObservacoesDoDia(data.scenes);

  return (
    <OrdemDoDiaWizard
      projectId={params.id}
      shootDay={data.shootDay}
      projeto={{ titulo: data.project.titulo, sigla: data.project.sigla }}
      locacaoInfo={locacaoInfo}
      castRows={castRows}
      extraRows={extraRows}
      chamadaEquipeInicial={chamadaEquipeInicial}
      sceneTimeRows={sceneTimeRows}
      initialStep={initialStep}
      passo3={{
        habilidades: habilidadesAgg.map((agg) => formatCharacterAggregation(agg, totalFor(agg.idCurto))),
        figurino: figurinoAgg.map((agg) => formatCharacterAggregation(agg, totalFor(agg.idCurto))),
        quickChanges: quickChanges.map((c) => ({ ...c, idCurto: getCharacterId(c, data.project) })),
        make: makeEntries.map((m) => ({
          idCurto: getCharacterId(m, data.project),
          descricao: m.descricao,
          especial: m.especial,
          sceneLabel: formatMakeSceneLabel(m.scenes, totalFor(m.idCurto)),
        })),
        objetosCriticos,
        objetosNormais,
        comidaCena,
        notes,
        posProducao,
        trilha,
        microfones,
        continuidadeAlerts,
        resumptionAlerts,
        pendingGapAlerts,
        observacoesPorCena,
      }}
    />
  );
}
