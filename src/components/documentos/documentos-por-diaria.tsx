"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CallsheetDownloadButton } from "@/components/reports/callsheet-download-button";
import { DownloadButton } from "@/components/reports/download-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { gerarNomeArquivo } from "@/lib/filename";
import { cn } from "@/lib/utils";

type ShootDayForDocs = {
  id: string;
  numeroDia: number;
  data: string;
  scenesSemTempoCount: number;
  hasDailyProgressReport: boolean;
};

/** Diária padrão ao abrir a página: a próxima diária futura/hoje (comparando datas em UTC), ou a
 *  última diária cadastrada caso todas já tenham passado. */
function pickDefaultDay(shootDays: ShootDayForDocs[]): string {
  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const sorted = [...shootDays].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
  const nextDay = sorted.find((d) => new Date(d.data).getTime() >= todayUTC);
  return (nextDay ?? sorted[sorted.length - 1]).id;
}

export function DocumentosPorDiaria({
  projectId,
  projeto,
  shootDays,
}: {
  projectId: string;
  projeto: { titulo: string; sigla: string | null };
  shootDays: ShootDayForDocs[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    shootDays.length > 0 ? pickDefaultDay(shootDays) : null
  );

  const selectedDay = useMemo(
    () => shootDays.find((d) => d.id === selectedId) ?? null,
    [shootDays, selectedId]
  );

  if (shootDays.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          Nenhuma diária cadastrada ainda. Crie diárias no Stripboard para gerar documentos.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {shootDays.map((day) => (
          <Button
            key={day.id}
            variant={day.id === selectedId ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedId(day.id)}
          >
            Diária {day.numeroDia} — {new Date(day.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
          </Button>
        ))}
      </div>

      {selectedDay && (
        <Card>
          <CardContent className={cn("flex flex-wrap gap-2 pt-6")}>
            <CallsheetDownloadButton
              projectId={projectId}
              shootDayId={selectedDay.id}
              filename={gerarNomeArquivo({
                projeto,
                tipo: "OD",
                variante: `Diaria${selectedDay.numeroDia}`,
                ext: "pdf",
              })}
              scenesSemTempoCount={selectedDay.scenesSemTempoCount}
            />
            <DownloadButton
              url={`/api/projects/${projectId}/reports/hhschedule?day=${selectedDay.id}`}
              filename={gerarNomeArquivo({
                projeto,
                tipo: "PlanoHH",
                variante: `Diaria${selectedDay.numeroDia}`,
                ext: "pdf",
              })}
              label="Plano de Filmagem (PDF)"
            />
            <DownloadButton
              url={`/api/projects/${projectId}/reports/breakdown?day=${selectedDay.id}`}
              filename={gerarNomeArquivo({
                projeto,
                tipo: "AT",
                variante: `Diaria${selectedDay.numeroDia}`,
                ext: "pdf",
              })}
              label="Análise Técnica (PDF)"
            />
            <DownloadButton
              url={`/api/projects/${projectId}/reports/shotlist?day=${selectedDay.id}`}
              filename={gerarNomeArquivo({
                projeto,
                tipo: "ShotList",
                variante: `Diaria${selectedDay.numeroDia}`,
                ext: "pdf",
              })}
              label="Lista de Planos (PDF)"
            />
            <DownloadButton
              url={`/api/projects/${projectId}/reports/continuismo?day=${selectedDay.id}`}
              filename={gerarNomeArquivo({
                projeto,
                tipo: "Continuismo",
                variante: `Diaria${selectedDay.numeroDia}`,
                ext: "pdf",
              })}
              label="Boletim de Continuísmo (PDF)"
            />

            {selectedDay.hasDailyProgressReport ? (
              <DownloadButton
                url={`/api/projects/${projectId}/ad-documents/daily-progress-report?day=${selectedDay.id}`}
                filename={gerarNomeArquivo({
                  projeto,
                  tipo: "DPR",
                  variante: `Diaria${selectedDay.numeroDia}`,
                  ext: "pdf",
                })}
                label="Relatório de Progresso Diário (PDF)"
              />
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" disabled>
                  Relatório de Progresso Diário (PDF)
                </Button>
                <span className="text-xs text-muted-foreground">Ainda não preenchido</span>
                <Button asChild variant="link" size="sm" className="h-8 px-0">
                  <Link href={`/projects/${projectId}/shootdays/${selectedDay.id}`}>Preencher agora</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedDay && (
        <Button size="lg" asChild>
          <Link href={`/projects/${projectId}/shootdays/${selectedDay.id}/ordem-do-dia`}>
            Abrir wizard da Ordem do Dia
          </Link>
        </Button>
      )}
    </div>
  );
}
