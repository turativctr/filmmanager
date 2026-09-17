import { notFound } from "next/navigation";

import { SetModeView } from "@/components/set-mode/set-mode-view";
import { getShootDayReportData } from "@/lib/report-data";
import { resolveSinopseAD } from "@/lib/scene-sinopse";

export default async function SetModePage({
  params,
}: {
  params: { id: string; shootDayId: string };
}) {
  const data = await getShootDayReportData(params.id, params.shootDayId);
  if (!data) notFound();

  const scenes = data.scenes.map((scene) => ({
    sceneId: scene.sceneId,
    ordem: scene.ordem,
    bloco: scene.bloco,
    numero: scene.numero,
    vinculoParte: scene.parte?.vinculo ?? null,
    setLocacaoDisplay: scene.setLocacaoDisplay,
    sinopseAD: resolveSinopseAD(scene),
    status: scene.status,
    shots: scene.shots.map((shot) => ({
      id: shot.id,
      numero: shot.numero,
      tamanho: shot.tamanho,
      movimento: shot.movimento,
      descricao: shot.descricao,
      takesPrevistos: shot.takesPrevistos,
      duracaoTakeMin: shot.duracaoTakeMin,
      status: shot.status,
      prioridade: shot.prioridade,
      notasDirecao: shot.notasDirecao,
    })),
  }));

  return (
    <SetModeView
      blocosDeTempo={data.blocosDeTempo}
      projectId={params.id}
      shootDayId={params.shootDayId}
      projetoTitulo={data.project.titulo}
      numeroDia={data.shootDay.numeroDia}
      data={data.shootDay.data}
      chamadaGeral={data.shootDay.chamadaGeral}
      initialScenes={scenes}
    />
  );
}
