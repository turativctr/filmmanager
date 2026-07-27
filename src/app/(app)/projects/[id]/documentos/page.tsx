import { Download } from "lucide-react";
import Link from "next/link";

import { ExportDoodButton } from "@/components/dood/export-dood-button";
import { DocumentosPorDiaria } from "@/components/documentos/documentos-por-diaria";
import { DownloadButton } from "@/components/reports/download-button";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { gerarNomeArquivo } from "@/lib/filename";
import { prisma } from "@/lib/prisma";

function SubGroupLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>;
}

function DisabledDownloadButton({ label, reason }: { label: string; reason: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" disabled>
        <Download className="mr-1.5 h-3.5 w-3.5" />
        {label}
      </Button>
      <span className="text-xs text-muted-foreground">{reason}</span>
    </div>
  );
}

export default async function DocumentosPage({ params }: { params: { id: string } }) {
  const [project, shootDays, scenesCount, castCount, dailyProgressReports] = await Promise.all([
    prisma.project.findUniqueOrThrow({
      where: { id: params.id },
      select: { titulo: true, sigla: true },
    }),
    prisma.shootDay.findMany({
      where: { projectId: params.id },
      orderBy: { numeroDia: "asc" },
      include: { scenes: { select: { rodMin: true } } },
    }),
    prisma.scene.count({ where: { projectId: params.id } }),
    prisma.character.count({ where: { projectId: params.id } }),
    prisma.dailyProgressReport.findMany({
      where: { shootDay: { projectId: params.id } },
      select: { shootDayId: true },
    }),
  ]);
  const projeto = { titulo: project.titulo, sigla: project.sigla };
  const daysWithReport = new Set(dailyProgressReports.map((r) => r.shootDayId));

  const shootDaysForClient = shootDays.map((day) => ({
    id: day.id,
    numeroDia: day.numeroDia,
    data: day.data.toISOString(),
    scenesSemTempoCount: day.scenes.filter((s) => !s.rodMin || s.rodMin === 0).length,
    hasDailyProgressReport: daysWithReport.has(day.id),
  }));

  return (
    <div className="space-y-4">
      <PageHeader title="Documentos" />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Do projeto</h2>
        <Card>
          <CardContent className="space-y-5 pt-6">
            <div className="space-y-2">
              <SubGroupLabel>Cronograma</SubGroupLabel>
              <div className="flex flex-wrap gap-2">
                {scenesCount === 0 ? (
                  <>
                    <DisabledDownloadButton label="Cronograma Resumido (XLSX)" reason="Nenhuma cena cadastrada" />
                    <DisabledDownloadButton label="Escaleta (PDF)" reason="Nenhuma cena cadastrada" />
                  </>
                ) : (
                  <>
                    <DownloadButton
                      url={`/api/projects/${params.id}/reports/one-line-schedule`}
                      filename={gerarNomeArquivo({ projeto, tipo: "OneLineSchedule", ext: "xlsx" })}
                      label="Cronograma Resumido (XLSX)"
                    />
                    <DownloadButton
                      url={`/api/projects/${params.id}/reports/escaleta`}
                      filename={gerarNomeArquivo({ projeto, tipo: "Escaleta", ext: "pdf" })}
                      label="Escaleta (PDF)"
                    />
                  </>
                )}
                <DownloadButton
                  url={`/api/projects/${params.id}/ad-documents/weekly-plan`}
                  filename={gerarNomeArquivo({ projeto, tipo: "PlanoSemanal", ext: "pdf" })}
                  label="Plano Semanal de Filmagem (PDF)"
                />
                <DownloadButton
                  url={`/api/projects/${params.id}/reports/plano-diarias`}
                  filename={gerarNomeArquivo({ projeto, tipo: "PlanoSimplificado", ext: "pdf" })}
                  label="Plano Simplificado para as Diárias (PDF)"
                />
              </div>
            </div>

            <div className="space-y-2">
              <SubGroupLabel>Elenco</SubGroupLabel>
              <div className="flex flex-wrap items-center gap-2">
                <ExportDoodButton projectId={params.id} projeto={projeto} />
                {castCount === 0 ? (
                  <DisabledDownloadButton label="Cronograma de Elenco (PDF)" reason="Nenhum personagem cadastrado" />
                ) : (
                  <DownloadButton
                    url={`/api/projects/${params.id}/reports/cast-schedule`}
                    filename={gerarNomeArquivo({ projeto, tipo: "CronogramaElenco", ext: "pdf" })}
                    label="Cronograma de Elenco (PDF)"
                  />
                )}
                <DownloadButton
                  url={`/api/projects/${params.id}/ad-documents/actor-scene-list`}
                  filename={gerarNomeArquivo({ projeto, tipo: "ListaAtores", ext: "pdf" })}
                  label="Lista de Cenas por Ator (PDF)"
                />
                <Button asChild variant="outline" size="sm">
                  <Link href={`/projects/${params.id}/ad-documents/cast-accounting`}>Abrir prestação de contas</Link>
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <SubGroupLabel>Locação</SubGroupLabel>
              <div className="flex flex-wrap gap-2">
                <DownloadButton
                  url={`/api/projects/${params.id}/ad-documents/location-scene-list`}
                  filename={gerarNomeArquivo({ projeto, tipo: "ListaLocacoes", ext: "pdf" })}
                  label="Lista de Cenas por Locação (PDF)"
                />
              </div>
            </div>

            <div className="space-y-2">
              <SubGroupLabel>Equipe</SubGroupLabel>
              <div className="flex flex-wrap gap-2">
                <DownloadButton
                  url={`/api/projects/${params.id}/ad-documents/crew-contact-list`}
                  filename={gerarNomeArquivo({ projeto, tipo: "Contatos", ext: "pdf" })}
                  label="Lista de Contatos da Equipe (PDF)"
                />
                <Button asChild variant="outline" size="sm">
                  <Link href={`/projects/${params.id}/ad-documents/crew`}>Gerenciar equipe</Link>
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <SubGroupLabel>Continuidade</SubGroupLabel>
              <div className="flex flex-wrap gap-2">
                <DownloadButton
                  url={`/api/projects/${params.id}/ad-documents/continuity-notes`}
                  filename={gerarNomeArquivo({ projeto, tipo: "NotasContinuidade", ext: "pdf" })}
                  label="Notas de Continuidade (PDF)"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Por diária</h2>
        <DocumentosPorDiaria projectId={params.id} projeto={projeto} shootDays={shootDaysForClient} />
      </section>
    </div>
  );
}
