"use client";

import { ClipboardList, FileDown, LayoutList, Tablet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AlmocoMarker } from "@/components/stripboard/almoco-marker";
import { AdicionarBlocoButton, BlocoCard } from "@/components/stripboard/bloco-card";
import { DayGroupingButtons } from "@/components/stripboard/day-grouping-buttons";
import { EditShootDayDialog } from "@/components/stripboard/edit-shoot-day-dialog";
import { DayPlanoView } from "@/components/stripboard/plano-view/day-plano-view";
import { StripCard } from "@/components/stripboard/strip-card";
import { StripDropZone } from "@/components/stripboard/strip-drop-zone";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { MissingTimesDialog } from "@/components/shared/missing-times-dialog";
import { ResetFatorControl } from "@/components/shared/reset-fator-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getCharacterId } from "@/lib/character-id";
import { detectSceneConflicts } from "@/lib/conflicts";
import { minutosEmBlocos, scheduleDoBloco } from "@/lib/day-timeline";
import { gerarNomeArquivo } from "@/lib/filename";
import { numeroComParte, paginasDaEntrada } from "@/lib/scene-parts-shared";
import { formatPaginas, formatTempoEstimado } from "@/lib/paginas";
import {
  computeBlockSchedule,
  type ComputedSchedule,
  formatHHh,
  minutesToTime,
  resolveEffectivePrepMin,
  resolveEffectiveRodMin,
  timeToMinutes,
  validateAlmocoTiming,
} from "@/lib/schedule";

import { almocoMarkerId, cenasDoDia, dayContainerId, dayItemId } from "./types";
import type { DayItem, DayState, StripItem } from "./types";

function toScheduleItem(i: DayItem) {
  if (i.tipo === "bloco") return scheduleDoBloco(i.bloco);
  const item = i.item;
  return {
    prepMin: resolveEffectivePrepMin(item.prepMin),
    // Parte: o fallback é o estimado da PARTE, não o da cena inteira.
    rodMin: resolveEffectiveRodMin(item.rodMin, item.parte ? item.parte.tempoEstimadoMin : item.scene.tempoEstimadoMin),
  };
}

export function ShootDayColumn({
  projectId,
  day,
  characterMap,
  sistemaIdElenco,
  projeto,
  jornada,
  onUpdateTimes,
}: {
  projectId: string;
  day: DayState;
  characterMap: Record<string, { idCurto: string; numeroElenco: number | null; personagem: string }>;
  sistemaIdElenco: "ID_CURTO" | "NUMERACAO";
  projeto: { titulo: string; sigla: string | null };
  jornada: { limiteAlmocoMin: number; duracaoAlmocoMin: number };
  onUpdateTimes: (itemId: string, prepMin: number | null, rodMin: number | null) => void;
}) {
  const resolveId = (id: string) => {
    const c = characterMap[id];
    return c ? getCharacterId(c, { sistemaIdElenco }) : id;
  };
  const router = useRouter();
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [showMissingTimesDialog, setShowMissingTimesDialog] = useState(false);
  const [planoViewOpen, setPlanoViewOpen] = useState(false);

  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/reports/callsheet?day=${day.id}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = gerarNomeArquivo({ projeto, tipo: "OD", variante: `Diaria${day.numeroDia}`, ext: "pdf" });
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloadingPdf(false);
    }
  }

  // Só as cenas contam páginas, elenco, conflito e falta de tempo; blocos de tempo só ocupam horário.
  const allItems = cenasDoDia(day);
  const manhaItens = day.itens.slice(0, day.almocoIndex);
  const tardeItens = day.itens.slice(day.almocoIndex);

  const scenesSemTempoCount = allItems.filter((i) => !i.rodMin || i.rodMin === 0).length;

  function handleDownloadPdfClick() {
    if (scenesSemTempoCount > 0) {
      setShowMissingTimesDialog(true);
      return;
    }
    handleDownloadPdf();
  }

  const manhaSchedule = useMemo(
    () => computeBlockSchedule(day.blocoManhaInicio, manhaItens.map(toScheduleItem)),
    [day.blocoManhaInicio, manhaItens]
  );

  // Bloco não é declarado, é consequência da posição do marcador — então almocoInicio/almocoFim (e por
  // tabela, a âncora do bloco tarde) são recalculados aqui a partir do acumulado da manhã em tempo real,
  // pra refletir instantaneamente qualquer drag otimista antes do round-trip com o servidor (que persiste
  // o mesmo cálculo via recalculateDayBlocks). blocoManhaInicio em si não muda por drag: só por
  // chamadaGeral/preparacaoInicialMin, que já vêm prontos do servidor.
  const lastManha = manhaSchedule[manhaSchedule.length - 1];
  const almocoInicio = lastManha ? lastManha.rodEnd : day.blocoManhaInicio;
  const almocoFim = almocoInicio ? minutesToTime(timeToMinutes(almocoInicio) + jornada.duracaoAlmocoMin) : null;

  const tardeSchedule = useMemo(
    () => computeBlockSchedule(almocoFim, tardeItens.map(toScheduleItem)),
    [almocoFim, tardeItens]
  );

  const almocoValidation = useMemo(
    () => validateAlmocoTiming(day.chamadaGeral, almocoInicio, jornada.limiteAlmocoMin),
    [day.chamadaGeral, almocoInicio, jornada.limiteAlmocoMin]
  );

  const conflicts = useMemo(() => {
    const all = [
      ...manhaItens.map((i, index) => ({ i, schedule: manhaSchedule[index] })),
      ...tardeItens.map((i, index) => ({ i, schedule: tardeSchedule[index] })),
    ].flatMap(({ i, schedule }) => (i.tipo === "cena" && schedule ? [{ item: i.item, schedule }] : []));

    return detectSceneConflicts(
      all.map(({ item, schedule }) => ({
        sceneId: item.sceneId,
        numero: numeroComParte(item.scene.numero, item.parte),
        characterIds: item.scene.characterIds,
        rodStartMin: timeToMinutes(schedule!.rodStart),
        rodEndMin: timeToMinutes(schedule!.rodEnd),
      })),
      (characterId) => {
        const c = characterMap[characterId];
        return c ? getCharacterId(c, { sistemaIdElenco }) : characterId;
      }
    );
  }, [manhaItens, tardeItens, manhaSchedule, tardeSchedule, characterMap, sistemaIdElenco]);

  // Parte de cena dividida conta só os oitavos dela — a outra parte está em outra diária.
  const totalPaginas = allItems.reduce((sum, item) => sum + paginasDaEntrada(Number(item.scene.paginas), item.parte), 0);
  const totalMinutos = allItems.reduce(
    (sum, item) => sum + ((item.parte ? item.parte.tempoEstimadoMin : item.scene.tempoEstimadoMin) ?? 0),
    0
  );
  const cortaveisMin = allItems.reduce((sum, item) => sum + (item.shotsSummary?.cortaveisMin ?? 0), 0);
  const blocosMin = minutosEmBlocos(day.itens.flatMap((i) => (i.tipo === "bloco" ? [i.bloco] : [])));
  const elencoPresente = [...new Set(allItems.flatMap((item) => item.scene.characterIds))].map(resolveId);

  const entryIds =
    day.itens.length === 0
      ? []
      : [...manhaItens.map(dayItemId), almocoMarkerId(day.id), ...tardeItens.map(dayItemId)];

  function renderItem(i: DayItem, schedule: ComputedSchedule | null) {
    if (i.tipo === "bloco") {
      return (
        <BlocoCard
          key={dayItemId(i)}
          projectId={projectId}
          shootDayId={day.id}
          bloco={i.bloco}
          schedule={schedule}
          onChanged={() => router.refresh()}
        />
      );
    }
    const item = i.item;
    return (
      <StripCard
        key={item.itemId}
        item={item}
        characterLabels={characterLabels(item)}
        schedule={schedule}
        conflicts={conflicts.get(item.sceneId)}
        onUpdateTimes={(prep, rod) => onUpdateTimes(item.itemId, prep, rod)}
        projectId={projectId}
        shootDayId={day.id}
        fatorResetPercent={day.fatorResetPercent}
      />
    );
  }

  function characterLabels(item: StripItem) {
    return item.scene.characterIds.map(resolveId);
  }

  async function handleDeleteDay() {
    await fetch(`/api/projects/${projectId}/shoot-days/${day.id}`, { method: "DELETE" });
    router.refresh();
  }

  async function handleFatorChange(fatorResetPercent: number) {
    const res = await fetch(`/api/projects/${projectId}/shoot-days/${day.id}/reset-fator`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fatorResetPercent }),
    });
    if (!res.ok) return;
    router.refresh();
  }

  return (
    <Card id={`shoot-day-${day.id}`} className="scroll-mt-4">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">
              Diária {day.numeroDia} —{" "}
              {new Date(day.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
            </h3>
            <p className="text-sm text-muted-foreground">
              {day.chamadaGeral && `Chamada geral: ${formatHHh(day.chamadaGeral)} · `}
              {formatPaginas(totalPaginas)} páginas · {formatTempoEstimado(totalMinutos)} de filmagem estimada
              {cortaveisMin > 0 && ` · ${formatTempoEstimado(cortaveisMin)} cortáveis`}
              {blocosMin > 0 && ` · ${formatTempoEstimado(blocosMin)} em blocos de tempo`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <ResetFatorControl value={day.fatorResetPercent} onChange={handleFatorChange} />
            <Button variant="outline" size="sm" asChild>
              <Link href={`/projects/${projectId}/shootdays/${day.id}/ordem-do-dia`}>
                <ClipboardList className="mr-1.5 h-3.5 w-3.5" />
                Ordem do dia
              </Link>
            </Button>
            {/* Direto pro set, sem passar pela OD: abre com o estado atual da diária, montada ou não. */}
            <Button variant="outline" size="sm" asChild>
              <Link href={`/projects/${projectId}/shootdays/${day.id}/set`}>
                <Tablet className="mr-1.5 h-3.5 w-3.5" />
                Modo Set
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadPdfClick} disabled={downloadingPdf}>
              <FileDown className="mr-1.5 h-3.5 w-3.5" />
              {downloadingPdf ? "Gerando..." : "PDF"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPlanoViewOpen(true)} disabled={allItems.length === 0}>
              <LayoutList className="mr-1.5 h-3.5 w-3.5" />
              Ver todos os planos do dia
            </Button>
            <EditShootDayDialog projectId={projectId} day={day} />
            <ConfirmDeleteDialog
              title={`Excluir diária ${day.numeroDia}?`}
              description="As cenas voltam para o Boneyard. Não pode ser desfeita."
              onConfirm={handleDeleteDay}
            />
          </div>
        </div>
        {elencoPresente.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {elencoPresente.map((label) => (
              <Badge key={label} variant="outline">
                {label}
              </Badge>
            ))}
          </div>
        )}
        {allItems.length > 0 && (
          <DayGroupingButtons
            projectId={projectId}
            sceneIds={allItems.map((item) => item.sceneId)}
            onApplied={() => router.refresh()}
          />
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <StripDropZone
          id={dayContainerId(day.id)}
          itemIds={entryIds}
          isEmpty={day.itens.length === 0}
          emptyLabel="Arraste cenas do Boneyard para esta diária"
        >
          {manhaItens.map((i, index) => renderItem(i, manhaSchedule[index]))}
          {day.itens.length > 0 && (
            <AlmocoMarker
              dayId={day.id}
              almocoInicio={almocoInicio}
              duracaoAlmocoMin={jornada.duracaoAlmocoMin}
              validation={almocoValidation}
            />
          )}
          {tardeItens.map((i, index) => renderItem(i, tardeSchedule[index]))}
        </StripDropZone>

        <AdicionarBlocoButton projectId={projectId} shootDayId={day.id} onAdded={() => router.refresh()} />

        {day.desprodInicio && (
          <p className="text-center text-xs text-muted-foreground">
            Desprodução: {formatHHh(day.desprodInicio)}
          </p>
        )}

        <MissingTimesDialog
          open={showMissingTimesDialog}
          onOpenChange={setShowMissingTimesDialog}
          count={scenesSemTempoCount}
          onPreencherAgora={() => router.push(`/projects/${projectId}/shootdays/${day.id}/ordem-do-dia?step=2`)}
          onContinuarAssimMesmo={handleDownloadPdf}
        />
      </CardContent>

      <Sheet open={planoViewOpen} onOpenChange={setPlanoViewOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>Todos os planos — Diária {day.numeroDia}</SheetTitle>
            <SheetDescription>
              Ordem de filmagem do dia inteiro, cruzando cenas — reorganize livremente aqui sem afetar a
              decupagem por cena.
            </SheetDescription>
          </SheetHeader>
          {planoViewOpen && (
            <DayPlanoView
              projectId={projectId}
              shootDayId={day.id}
              scenes={allItems.map((item) => ({
                id: item.sceneId,
                numero: numeroComParte(item.scene.numero, item.parte),
                parteId: item.scenePartId,
              }))}
              fatorResetPercent={day.fatorResetPercent}
            />
          )}
        </SheetContent>
      </Sheet>
    </Card>
  );
}
