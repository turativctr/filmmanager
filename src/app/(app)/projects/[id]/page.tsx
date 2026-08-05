import { CalendarRange, ClipboardList } from "lucide-react";
import Link from "next/link";
import { getServerSession } from "next-auth";

import { currentStepIndex } from "@/components/projects/guided-progress-panel";
import { ProjectStatusBadges } from "@/components/projects/project-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WelcomeTourModal } from "@/components/tour/welcome-tour-modal";
import { authOptions } from "@/lib/auth";
import { formatHHhOrDash } from "@/lib/schedule";
import { formatPaginas } from "@/lib/paginas";
import { computeProjectSteps } from "@/lib/project-step";
import { getProjectHomeState, type TaskRow } from "@/lib/project-home";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

import { STATUS_BADGE_CLASS, STATUS_LABEL, type SceneShootDayStatusValue } from "@/lib/scene-progress";

function formatData(date: Date): string {
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function TarefasList({ projectId, tarefas }: { projectId: string; tarefas: TaskRow[] }) {
  if (tarefas.length === 0) return null;
  const hoje = new Date();

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <p className="text-sm font-medium">Tarefas</p>
        <ul className="space-y-1.5">
          {tarefas.map((t) => {
            const atrasada = t.prazo < hoje;
            return (
              <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{t.titulo}</span>
                <span className="flex shrink-0 items-center gap-1.5 text-xs">
                  {t.responsavel && <span className="text-muted-foreground">{t.responsavel}</span>}
                  <Badge variant="outline" className={cn(atrasada && "border-erro-accent/40 bg-erro-bg text-erro-fg")}>
                    {formatData(t.prazo)}
                  </Badge>
                </span>
              </li>
            );
          })}
        </ul>
        <Link
          href={`/projects/${projectId}/calendar`}
          className="inline-block text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          Ver no calendário →
        </Link>
      </CardContent>
    </Card>
  );
}

function EventosList({ eventos }: { eventos: { id: string; nome: string; data: Date }[] }) {
  if (eventos.length === 0) return null;

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <p className="text-sm font-medium">Próximos eventos</p>
        <ul className="space-y-1.5 text-sm">
          {eventos.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2">
              <span className="truncate">{e.nome}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatData(e.data)}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default async function ProjectOverviewPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  const [project, currentUser, state] = await Promise.all([
    prisma.project.findUniqueOrThrow({
      where: { id: params.id },
      select: { titulo: true, diretor: true, producao: true, status: true, arquivado: true },
    }),
    session ? prisma.user.findUnique({ where: { id: session.user.id }, select: { tourConcluido: true } }) : null,
    getProjectHomeState(params.id),
  ]);

  const steps = state.kind === "A" ? await computeProjectSteps(params.id) : null;

  return (
    <div className="space-y-4">
      {/* Única página do projeto que mostra nome/créditos/status — em toda outra página essa
          informação já vive no breadcrumb do Header global, ver PageHeader. */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{project.titulo}</h1>
          <ProjectStatusBadges status={project.status} arquivado={project.arquivado} />
        </div>
        <p className="text-sm text-muted-foreground">
          {[project.diretor && `Direção: ${project.diretor}`, project.producao].filter(Boolean).join(" · ")}
        </p>
      </div>

      {state.kind === "A" && steps && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Bem-vindo(a) ao {project.titulo}. Ainda não há cenas neste projeto — comece pelos passos abaixo.
          </p>
          <Card>
            <CardContent className="space-y-3 p-4">
              <p className="text-sm font-medium">Comece por aqui</p>
              {(() => {
                const idx = currentStepIndex(steps);
                return [0, 1, 3].map((stepIndex) => {
                  const step = steps[stepIndex];
                  const available = stepIndex <= idx;
                  return (
                    <div key={step.key} className="flex items-center justify-between gap-3">
                      <div className={cn("space-y-0.5", !available && "opacity-50")}>
                        <p className="text-sm font-medium">{step.title}</p>
                        <p className="text-xs text-muted-foreground">{step.description}</p>
                      </div>
                      {available ? (
                        <Button size="sm" variant="outline" asChild className="shrink-0">
                          <Link href={step.href}>{step.actionLabel}</Link>
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled className="shrink-0 pointer-events-none opacity-50">
                          {step.actionLabel}
                        </Button>
                      )}
                    </div>
                  );
                });
              })()}
            </CardContent>
          </Card>
          <Link
            href={`/projects/${params.id}/guia`}
            className="inline-block text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            Ver guia completo →
          </Link>
        </div>
      )}

      {state.kind === "B" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-semibold">{state.totalCenas}</p>
                <p className="text-xs text-muted-foreground">cenas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-semibold">{formatPaginas(state.totalPaginas)}</p>
                <p className="text-xs text-muted-foreground">páginas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-semibold">{state.totalTempoMin}</p>
                <p className="text-xs text-muted-foreground">min estimados</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-semibold">{state.totalLocacoes}</p>
                <p className="text-xs text-muted-foreground">locações</p>
              </CardContent>
            </Card>
          </div>
          <TarefasList projectId={params.id} tarefas={state.tarefas} />
          <Card className="border-alerta-accent/30 bg-alerta-bg">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <p className="text-sm text-alerta-fg">Nenhuma diária agendada ainda.</p>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/projects/${params.id}/stripboard`}>Abrir Stripboard</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {state.kind === "C" && (
        <div className="space-y-4">
          {state.proximaDiaria && (
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <CalendarRange className="h-6 w-6 shrink-0 text-scheduling-accent" />
                <p className="text-base font-semibold">
                  Diária {state.proximaDiaria.numeroDia} em {state.proximaDiaria.diasRestantes}{" "}
                  {state.proximaDiaria.diasRestantes === 1 ? "dia" : "dias"} · {formatData(state.proximaDiaria.data)}
                  {state.proximaDiaria.label && ` · ${state.proximaDiaria.label}`}
                </p>
              </CardContent>
            </Card>
          )}

          {state.forecast && (
            <Card>
              <CardContent className="p-4 text-sm">
                {state.forecast.kind === "agendado" ? (
                  <p>
                    Término previsto: {formatData(state.forecast.data)} — {state.forecast.diariasAgendadas}{" "}
                    {state.forecast.diariasAgendadas === 1 ? "diária agendada" : "diárias agendadas"}
                  </p>
                ) : (
                  <p>
                    Término previsto: ~{formatData(state.forecast.data)} — estimativa, {state.forecast.cenasNoBoneyard}{" "}
                    {state.forecast.cenasNoBoneyard === 1 ? "cena ainda no boneyard" : "cenas ainda no boneyard"}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 text-sm">
              <p>
                {state.progresso.cenasConcluidas} de {state.progresso.totalCenas} cenas filmadas ·{" "}
                {formatPaginas(state.progresso.paginasConcluidas)} de {formatPaginas(state.progresso.totalPaginas)} páginas
              </p>
            </CardContent>
          </Card>

          <TarefasList projectId={params.id} tarefas={state.tarefas} />
          <EventosList eventos={state.eventos} />
        </div>
      )}

      {state.kind === "D" && (
        <div className="space-y-4">
          <Card className="border-scheduling-accent/30">
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">Diária {state.shootDay.numeroDia} — hoje</p>
                  <p className="text-sm text-muted-foreground">
                    {state.shootDay.locacaoNome ?? "Locação não definida"} · Chamada geral:{" "}
                    {formatHHhOrDash(state.shootDay.chamadaGeral)} · {state.scenes.length}{" "}
                    {state.scenes.length === 1 ? "cena" : "cenas"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" asChild>
                    <Link href={`/projects/${params.id}/shootdays/${state.shootDay.id}/set`}>Abrir modo set</Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/projects/${params.id}/shootdays/${state.shootDay.id}/ordem-do-dia`}>
                      <ClipboardList className="mr-1.5 h-3.5 w-3.5" />
                      Ordem do dia
                    </Link>
                  </Button>
                </div>
              </div>
              <ul className="flex flex-wrap gap-2">
                {state.scenes.map((s) => (
                  <li key={s.sceneId}>
                    <Badge className={STATUS_BADGE_CLASS[s.status as SceneShootDayStatusValue]}>
                      {s.numero} · {STATUS_LABEL[s.status as SceneShootDayStatusValue]}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-2">
            <TarefasList projectId={params.id} tarefas={state.tarefasAtrasadas} />
            <EventosList eventos={state.eventos} />
          </div>
        </div>
      )}

      {currentUser && !currentUser.tourConcluido && <WelcomeTourModal projectId={params.id} />}
    </div>
  );
}
