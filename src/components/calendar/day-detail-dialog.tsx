"use client";

import { ClipboardList, FileDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { MissingTimesDialog } from "@/components/shared/missing-times-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getCharacterId } from "@/lib/character-id";
import { gerarNomeArquivo } from "@/lib/filename";
import { formatPaginas } from "@/lib/paginas";
import { formatHHh } from "@/lib/schedule";

import { CalendarBadge, EVENT_TYPE_LABEL } from "./calendar-badge";
import type { CalendarDayData } from "./types";

export function DayDetailDialog({
  projectId,
  day,
  sistemaIdElenco,
  projeto,
  open,
  onOpenChange,
}: {
  projectId: string;
  day: CalendarDayData | null;
  sistemaIdElenco: "ID_CURTO" | "NUMERACAO";
  projeto: { titulo: string; sigla: string | null };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [showMissingTimesDialog, setShowMissingTimesDialog] = useState(false);

  async function handleDeleteEvent(eventId: string) {
    await fetch(`/api/projects/${projectId}/calendar-events/${eventId}`, { method: "DELETE" });
    router.refresh();
  }

  async function handleDownloadPdf(shootDayId: string, numeroDia: number) {
    setDownloadingPdf(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/reports/callsheet?day=${shootDayId}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = gerarNomeArquivo({ projeto, tipo: "OD", variante: `Diaria${numeroDia}`, ext: "pdf" });
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloadingPdf(false);
    }
  }

  function handleDownloadPdfClick() {
    if (!day?.shootDay) return;
    if (day.shootDay.scenesSemTempoCount > 0) {
      setShowMissingTimesDialog(true);
      return;
    }
    handleDownloadPdf(day.shootDay.id, day.shootDay.numeroDia);
  }

  if (!day) return null;

  const [year, month, dayNum] = day.dateKey.split("-").map(Number);
  const formattedDate = new Date(Date.UTC(year, month - 1, dayNum)).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{formattedDate}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {day.shootDay && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">
                  Diária {day.shootDay.numeroDia}
                  {day.shootDay.locacao ? ` — ${day.shootDay.locacao}` : ""}
                </h4>
                <span className="text-xs text-muted-foreground">
                  {formatPaginas(day.shootDay.totalPaginas)} páginas
                </span>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/projects/${projectId}/shootdays/${day.shootDay.id}/ordem-do-dia`}>
                    <ClipboardList className="mr-1.5 h-3.5 w-3.5" />
                    Abrir ordem do dia
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPdfClick}
                  disabled={downloadingPdf}
                >
                  <FileDown className="mr-1.5 h-3.5 w-3.5" />
                  {downloadingPdf ? "Gerando..." : "Gerar Call Sheet PDF"}
                </Button>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Cenas</p>
                <ul className="space-y-1 text-sm">
                  {day.shootDay.scenes.map((scene, index) => (
                    <li key={`${scene.numero}-${index}`}>
                      <span className="font-semibold">{scene.numero}</span>
                      {scene.sinopse ? ` — ${scene.sinopse}` : ""}
                    </li>
                  ))}
                </ul>
              </div>

              {day.shootDay.castPresente.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                    Elenco (chegada → saída)
                  </p>
                  <ul className="space-y-1 text-sm">
                    {day.shootDay.castPresente.map((cast) => (
                      <li key={cast.characterId} className="flex justify-between">
                        <span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {getCharacterId(cast, { sistemaIdElenco })}
                          </span>{" "}
                          {cast.personagem}
                        </span>
                        <span className="text-muted-foreground">
                          {cast.chamada ? formatHHh(cast.chamada) : "—"} →{" "}
                          {cast.saida ? formatHHh(cast.saida) : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                  HH resumido
                </p>
                <p className="text-sm text-muted-foreground">
                  {day.shootDay.chamadaGeral && `Chamada ${formatHHh(day.shootDay.chamadaGeral)}`}
                  {day.shootDay.blocoManhaInicio &&
                    ` · Manhã ${formatHHh(day.shootDay.blocoManhaInicio)}`}
                  {day.shootDay.almocoInicio &&
                    day.shootDay.almocoFim &&
                    ` · Almoço ${formatHHh(day.shootDay.almocoInicio)}-${formatHHh(day.shootDay.almocoFim)}`}
                  {day.shootDay.blocoTardeInicio &&
                    ` · Tarde ${formatHHh(day.shootDay.blocoTardeInicio)}`}
                  {day.shootDay.desprodInicio &&
                    ` · Desprodução ${formatHHh(day.shootDay.desprodInicio)}`}
                </p>
              </div>
            </div>
          )}

          {day.events.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase text-muted-foreground">Eventos</p>
              {day.events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between rounded-md border p-2"
                >
                  <div>
                    <CalendarBadge variant={event.tipo}>
                      {EVENT_TYPE_LABEL[event.tipo]}
                    </CalendarBadge>
                    <p className="mt-1 text-sm">{event.nome}</p>
                  </div>
                  <ConfirmDeleteDialog
                    title={`Excluir "${event.nome}"?`}
                    description="Essa ação não pode ser desfeita."
                    onConfirm={() => handleDeleteEvent(event.id)}
                  />
                </div>
              ))}
            </div>
          )}

          {!day.shootDay && day.events.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma diária ou evento neste dia.</p>
          )}
        </div>
      </DialogContent>

      {day.shootDay && (
        <MissingTimesDialog
          open={showMissingTimesDialog}
          onOpenChange={setShowMissingTimesDialog}
          count={day.shootDay.scenesSemTempoCount}
          onPreencherAgora={() =>
            router.push(`/projects/${projectId}/shootdays/${day.shootDay!.id}/ordem-do-dia?step=2`)
          }
          onContinuarAssimMesmo={() => handleDownloadPdf(day.shootDay!.id, day.shootDay!.numeroDia)}
        />
      )}
    </Dialog>
  );
}
