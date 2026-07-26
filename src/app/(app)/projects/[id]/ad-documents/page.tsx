import { CalendarClock, Users, Wallet } from "lucide-react";
import Link from "next/link";

import { DownloadButton } from "@/components/reports/download-button";
import { InfoBanner } from "@/components/shared/info-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { gerarNomeArquivo } from "@/lib/filename";
import { prisma } from "@/lib/prisma";

export default async function AdDocumentsPage({ params }: { params: { id: string } }) {
  const [project, shootDays] = await Promise.all([
    prisma.project.findUniqueOrThrow({
      where: { id: params.id },
      select: { titulo: true, sigla: true },
    }),
    prisma.shootDay.findMany({
      where: { projectId: params.id },
      orderBy: { numeroDia: "asc" },
      select: { id: true, numeroDia: true, data: true },
    }),
  ]);
  const projeto = { titulo: project.titulo, sigla: project.sigla };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Documentos do AD</h1>
        <p className="text-sm text-muted-foreground">
          Documentos de produção gerados automaticamente a partir dos dados já cadastrados.
        </p>
      </div>

      <InfoBanner
        storageKey="ad-documents"
        title="Documentos do AD"
        description="Todos os documentos que o Assistente de Direção precisa, gerados automaticamente a partir dos dados do projeto: plano semanal, lista de cenas por ator, escaleta, hora a hora e mais."
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Planejamento</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <DownloadButton
            url={`/api/projects/${params.id}/ad-documents/weekly-plan`}
            filename={gerarNomeArquivo({ projeto, tipo: "PlanoSemanal", ext: "pdf" })}
            label="Plano Semanal de Filmagem"
          />
          <DownloadButton
            url={`/api/projects/${params.id}/ad-documents/actor-scene-list`}
            filename={gerarNomeArquivo({ projeto, tipo: "ListaAtores", ext: "pdf" })}
            label="Lista de Cenas por Ator"
          />
          <DownloadButton
            url={`/api/projects/${params.id}/ad-documents/location-scene-list`}
            filename={gerarNomeArquivo({ projeto, tipo: "ListaLocacoes", ext: "pdf" })}
            label="Lista de Cenas por Locação"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-base">
            <CalendarClock className="h-4 w-4" />
            Daily Progress Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Preenchido por diária — acesse o painel da diária para registrar e gerar o PDF.
          </p>
          {shootDays.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma diária cadastrada ainda.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {shootDays.map((day) => (
                <Button key={day.id} variant="outline" size="sm" asChild>
                  <Link href={`/projects/${params.id}/shootdays/${day.id}`}>Diária {day.numeroDia}</Link>
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Continuidade</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <DownloadButton
            url={`/api/projects/${params.id}/ad-documents/continuity-notes`}
            filename={gerarNomeArquivo({ projeto, tipo: "NotasContinuidade", ext: "pdf" })}
            label="Notas de Continuidade"
          />
          <p className="text-xs text-muted-foreground">
            Notas são adicionadas na página de Breakdown de cada cena.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-base">
            <Wallet className="h-4 w-4" />
            Prestação de Contas do Elenco
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" size="sm">
            <Link href={`/projects/${params.id}/ad-documents/cast-accounting`}>Abrir prestação de contas</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-base">
            <Users className="h-4 w-4" />
            Lista de Contatos da Equipe
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <DownloadButton
            url={`/api/projects/${params.id}/ad-documents/crew-contact-list`}
            filename={gerarNomeArquivo({ projeto, tipo: "Contatos", ext: "pdf" })}
            label="Baixar lista de contatos"
          />
          <Button asChild variant="outline" size="sm">
            <Link href={`/projects/${params.id}/ad-documents/crew`}>Gerenciar equipe</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
