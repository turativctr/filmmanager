"use client";

import { ClipboardList, FileDown, LayoutList } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { DayGroupingButtons } from "@/components/stripboard/day-grouping-buttons";
import { EditShootDayDialog } from "@/components/stripboard/edit-shoot-day-dialog";
import { DayPlanoView } from "@/components/stripboard/plano-view/day-plano-view";
import { StripCard } from "@/components/stripboard/strip-card";
import { StripDropZone } from "@/components/stripboard/strip-drop-zone";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { MissingTimesDialog } from "@/components/shared/missing-times-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getCharacterId } from "@/lib/character-id";
import { detectSceneConflicts } from "@/lib/conflicts";
import { gerarNomeArquivo } from "@/lib/filename";
import { formatPaginas } from "@/lib/paginas";
import {
  computeBlockSchedule,
  formatHHh,
  resolveEffectivePrepMin,
  resolveEffectiveRodMin,
  timeToMinutes,
} from "@/lib/schedule";

import { dayContainerId } from "./types";
import type { DayState, StripItem } from "./types";

export function ShootDayColumn({
  projectId,
  day,
  characterMap,
  sistemaIdElenco,
  projeto,
  onUpdateTimes,
}: {
  projectId: string;
  day: DayState;
  characterMap: Record<string, { idCurto: string; numeroElenco: number | null; personagem: string }>;
  sistemaIdElenco: "ID_CURTO" | "NUMERACAO";
  projeto: { titulo: string; sigla: string | null };
  onUpdateTimes: (sceneId: string, prepMin: number | null, rodMin: number | null) => void;
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

  const scenesSemTempoCount = [...day.manha, ...day.tarde].filter(
    (i) => !i.rodMin || i.rodMin === 0
  ).length;

  function handleDownloadPdfClick() {
    if (scenesSemTempoCount > 0) {
      setShowMissingTimesDialog(true);
      return;
    }
    handleDownloadPdf();
  }

  const manhaSchedule = useMemo(
    () =>
      computeBlockSchedule(
        day.blocoManhaInicio,
        day.manha.map((i) => ({
          prepMin: resolveEffectivePrepMin(i.prepMin),
          rodMin: resolveEffectiveRodMin(i.rodMin, i.scene.tempoEstimadoMin),
        }))
      ),
    [day.blocoManhaInicio, day.manha]
  );
  const tardeSchedule = useMemo(
    () =>
      computeBlockSchedule(
        day.blocoTardeInicio,
        day.tarde.map((i) => ({
          prepMin: resolveEffectivePrepMin(i.prepMin),
          rodMin: resolveEffectiveRodMin(i.rodMin, i.scene.tempoEstimadoMin),
        }))
      ),
    [day.blocoTardeInicio, day.tarde]
  );

  const conflicts = useMemo(() => {
    const all = [
      ...day.manha.map((item, index) => ({ item, schedule: manhaSchedule[index] })),
      ...day.tarde.map((item, index) => ({ item, schedule: tardeSchedule[index] })),
    ].filter((entry) => entry.schedule);

    return detectSceneConflicts(
      all.map(({ item, schedule }) => ({
        sceneId: item.sceneId,
        numero: item.scene.numero,
        characterIds: item.scene.characterIds,
        rodStartMin: timeToMinutes(schedule!.rodStart),
        rodEndMin: timeToMinutes(schedule!.rodEnd),
      })),
      (characterId) => {
        const c = characterMap[characterId];
        return c ? getCharacterId(c, { sistemaIdElenco }) : characterId;
      }
    );
  }, [day.manha, day.tarde, manhaSchedule, tardeSchedule, characterMap, sistemaIdElenco]);

  const allItems = [...day.manha, ...day.tarde];
  const totalPaginas = allItems.reduce((sum, item) => sum + Number(item.scene.paginas), 0);
  const totalMinutos = allItems.reduce((sum, item) => sum + (item.scene.tempoEstimadoMin ?? 0), 0);
  const elencoPresente = [...new Set(allItems.flatMap((item) => item.scene.characterIds))].map(resolveId);

  function characterLabels(item: StripItem) {
    return item.scene.characterIds.map(resolveId);
  }

  async function handleDeleteDay() {
    await fetch(`/api/projects/${projectId}/shoot-days/${day.id}`, { method: "DELETE" });
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
              {formatPaginas(totalPaginas)} páginas · {totalMinutos} min estimados
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/projects/${projectId}/shootdays/${day.id}/ordem-do-dia`}>
                <ClipboardList className="mr-1.5 h-3.5 w-3.5" />
                Ordem do dia
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
        <div>
          <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
            Bloco manhã{day.blocoManhaInicio && ` · início ${formatHHh(day.blocoManhaInicio)}`}
          </p>
          <StripDropZone
            id={dayContainerId(day.id, "MANHA")}
            itemIds={day.manha.map((i) => i.sceneId)}
            emptyLabel="Arraste cenas para o bloco da manhã"
          >
            {day.manha.map((item, index) => (
              <StripCard
                key={item.sceneId}
                item={item}
                characterLabels={characterLabels(item)}
                schedule={manhaSchedule[index]}
                conflicts={conflicts.get(item.sceneId)}
                onUpdateTimes={(prep, rod) => onUpdateTimes(item.sceneId, prep, rod)}
                projectId={projectId}
                shootDayId={day.id}
              />
            ))}
          </StripDropZone>
        </div>

        {(day.almocoInicio || day.almocoFim) && (
          <div className="rounded-md border border-dashed px-3 py-1.5 text-center text-xs text-muted-foreground">
            Almoço: {day.almocoInicio && formatHHh(day.almocoInicio)}
            {day.almocoInicio && day.almocoFim && " às "}
            {day.almocoFim && formatHHh(day.almocoFim)}
          </div>
        )}

        <div>
          <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
            Bloco tarde{day.blocoTardeInicio && ` · início ${formatHHh(day.blocoTardeInicio)}`}
          </p>
          <StripDropZone
            id={dayContainerId(day.id, "TARDE")}
            itemIds={day.tarde.map((i) => i.sceneId)}
            emptyLabel="Arraste cenas para o bloco da tarde"
          >
            {day.tarde.map((item, index) => (
              <StripCard
                key={item.sceneId}
                item={item}
                characterLabels={characterLabels(item)}
                schedule={tardeSchedule[index]}
                conflicts={conflicts.get(item.sceneId)}
                onUpdateTimes={(prep, rod) => onUpdateTimes(item.sceneId, prep, rod)}
                projectId={projectId}
                shootDayId={day.id}
              />
            ))}
          </StripDropZone>
        </div>

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
              scenes={allItems.map((item) => ({ id: item.sceneId, numero: item.scene.numero }))}
            />
          )}
        </SheetContent>
      </Sheet>
    </Card>
  );
}
