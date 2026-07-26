import { ClipboardList } from "lucide-react";
import Link from "next/link";

import { ExportDoodButton } from "@/components/dood/export-dood-button";
import { CallsheetDownloadButton } from "@/components/reports/callsheet-download-button";
import { DownloadButton } from "@/components/reports/download-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { gerarNomeArquivo } from "@/lib/filename";
import { prisma } from "@/lib/prisma";

export default async function ReportsPage({ params }: { params: { id: string } }) {
  const [project, shootDays] = await Promise.all([
    prisma.project.findUniqueOrThrow({
      where: { id: params.id },
      select: { titulo: true, sigla: true },
    }),
    prisma.shootDay.findMany({
      where: { projectId: params.id },
      orderBy: { numeroDia: "asc" },
      include: { scenes: { select: { rodMin: true } } },
    }),
  ]);
  const projeto = { titulo: project.titulo, sigla: project.sigla };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Exportações do projeto</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <ExportDoodButton projectId={params.id} projeto={projeto} />
          <DownloadButton
            url={`/api/projects/${params.id}/reports/one-line-schedule`}
            filename={gerarNomeArquivo({ projeto, tipo: "OneLineSchedule", ext: "xlsx" })}
            label="One-Line Schedule (XLSX)"
          />
          <DownloadButton
            url={`/api/projects/${params.id}/reports/escaleta`}
            filename={gerarNomeArquivo({ projeto, tipo: "Escaleta", ext: "pdf" })}
            label="Escaleta (PDF)"
          />
          <DownloadButton
            url={`/api/projects/${params.id}/reports/cast-schedule`}
            filename={gerarNomeArquivo({ projeto, tipo: "CronogramaElenco", ext: "pdf" })}
            label="Cronograma de Elenco (PDF)"
          />
          <DownloadButton
            url={`/api/projects/${params.id}/reports/plano-diarias`}
            filename={gerarNomeArquivo({ projeto, tipo: "PlanoSimplificado", ext: "pdf" })}
            label="Plano Simplificado para as Diárias (PDF)"
          />
        </CardContent>
      </Card>

      {shootDays.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Nenhuma diária cadastrada ainda. Crie diárias no Stripboard para gerar relatórios.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {shootDays.map((day) => (
            <Card key={day.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">
                  Diária {day.numeroDia} — {day.data.toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                </CardTitle>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/projects/${params.id}/shootdays/${day.id}/ordem-do-dia`}>
                    <ClipboardList className="mr-1.5 h-3.5 w-3.5" />
                    Ordem do dia
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <CallsheetDownloadButton
                  projectId={params.id}
                  shootDayId={day.id}
                  filename={gerarNomeArquivo({ projeto, tipo: "OD", variante: `Diaria${day.numeroDia}`, ext: "pdf" })}
                  scenesSemTempoCount={day.scenes.filter((s) => !s.rodMin || s.rodMin === 0).length}
                />
                <DownloadButton
                  url={`/api/projects/${params.id}/reports/hhschedule?day=${day.id}`}
                  filename={gerarNomeArquivo({ projeto, tipo: "PlanoHH", variante: `Diaria${day.numeroDia}`, ext: "pdf" })}
                  label="Plano de Filmagem (PDF)"
                />
                <DownloadButton
                  url={`/api/projects/${params.id}/reports/breakdown?day=${day.id}`}
                  filename={gerarNomeArquivo({ projeto, tipo: "AT", variante: `Diaria${day.numeroDia}`, ext: "pdf" })}
                  label="Análise Técnica (PDF)"
                />
                <DownloadButton
                  url={`/api/projects/${params.id}/reports/shotlist?day=${day.id}`}
                  filename={gerarNomeArquivo({ projeto, tipo: "ShotList", variante: `Diaria${day.numeroDia}`, ext: "pdf" })}
                  label="Shot List (PDF)"
                />
                <DownloadButton
                  url={`/api/projects/${params.id}/reports/continuismo?day=${day.id}`}
                  filename={gerarNomeArquivo({ projeto, tipo: "Continuismo", variante: `Diaria${day.numeroDia}`, ext: "pdf" })}
                  label="Boletim de Continuísmo (PDF)"
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
