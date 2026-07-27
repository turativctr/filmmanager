import { CalendarDays } from "lucide-react";
import Link from "next/link";

import { ExportDoodButton } from "@/components/dood/export-dood-button";
import { StatusCell } from "@/components/dood/status-cell";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { TermTooltip } from "@/components/shared/term-tooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCharacterId } from "@/lib/character-id";
import { getProjectDoodData } from "@/lib/dood-data";
import { formatHHh } from "@/lib/schedule";

const DOOD_HELP = {
  title: "DOOD (Day Out of Days)",
  description:
    "Tabela que mostra quando cada ator trabalha ao longo da produção. SW = primeiro dia, W = trabalhando, H = contratado mas de folga, WF = último dia. Usado para calcular contratos e cachês.",
};

export default async function DoodPage({ params }: { params: { id: string } }) {
  const { project, shootDays, characterRows, extraRows, totalsByDay, mealsByDay } =
    await getProjectDoodData(params.id);

  if (shootDays.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="DOOD" help={DOOD_HELP} />
        <EmptyState
          icon={CalendarDays}
          title="Ainda não há diárias"
          description="O DOOD aparece quando você tiver dias de filmagem no Stripboard."
          actions={
            <Button asChild>
              <Link href={`/projects/${params.id}/stripboard`}>Ir para o Stripboard</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="DOOD"
        help={DOOD_HELP}
        actions={
          <ExportDoodButton
            projectId={params.id}
            projeto={{ titulo: project?.titulo ?? "", sigla: project?.sigla ?? null }}
          />
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-muted/50">Elemento</TableHead>
                {shootDays.map((day) => (
                  <TableHead key={day.id} className="whitespace-nowrap text-center">
                    {new Date(day.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })} · Dia{" "}
                    {day.numeroDia}
                  </TableHead>
                ))}
                <TableHead className="text-center">
                  <span className="inline-flex items-center gap-1">
                    W
                    <TermTooltip content="Status do ator no DOOD: SW = Start Work (primeiro dia), W = Working (trabalhando), H = Hold (contratado mas não filmando), WF = Work Finish (último dia)." />
                  </span>
                </TableHead>
                <TableHead className="text-center">H</TableHead>
                <TableHead className="text-center">Contratado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {characterRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="sticky left-0 bg-background font-medium">
                    <span className="mr-1.5 font-mono text-xs text-muted-foreground">
                      {getCharacterId(row, { sistemaIdElenco: project?.sistemaIdElenco ?? "ID_CURTO" })}
                    </span>
                    {row.personagem}
                  </TableCell>
                  {row.cells.map((status, index) => (
                    <StatusCell key={index} status={status} />
                  ))}
                  <TableCell className="text-center">{row.totalW}</TableCell>
                  <TableCell className="text-center">{row.totalH}</TableCell>
                  <TableCell className="text-center font-medium">{row.totalContracted}</TableCell>
                </TableRow>
              ))}

              {extraRows.map((row) => (
                <TableRow key={row.id} className="bg-muted/20">
                  <TableCell className="sticky left-0 bg-muted/20">
                    {row.personagem} <span className="text-muted-foreground">({row.quantidade})</span>
                  </TableCell>
                  {row.cells.map((status, index) => (
                    <StatusCell key={index} status={status} />
                  ))}
                  <TableCell colSpan={3} />
                </TableRow>
              ))}

              <TableRow className="border-t-2 font-medium">
                <TableCell className="sticky left-0 bg-background">Total elenco</TableCell>
                {totalsByDay.map((t) => (
                  <TableCell key={t.shootDayId} className="text-center">
                    {t.totalElenco}
                  </TableCell>
                ))}
                <TableCell colSpan={3} />
              </TableRow>
              <TableRow className="font-medium">
                <TableCell className="sticky left-0 bg-background">Total figuração</TableCell>
                {totalsByDay.map((t) => (
                  <TableCell key={t.shootDayId} className="text-center">
                    {t.totalFiguracao}
                  </TableCell>
                ))}
                <TableCell colSpan={3} />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contagem de refeições</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Diária</TableHead>
                <TableHead className="text-center">Total pessoas</TableHead>
                <TableHead className="text-center">Café da manhã</TableHead>
                <TableHead className="text-center">Almoço</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mealsByDay.map((meal, index) => (
                <TableRow key={meal.shootDayId}>
                  <TableCell>
                    Dia {shootDays[index].numeroDia} —{" "}
                    {new Date(shootDays[index].data).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                    {shootDays[index].blocoManhaInicio && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        (início {formatHHh(shootDays[index].blocoManhaInicio!)})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center font-medium">{meal.totalPessoas}</TableCell>
                  <TableCell className="text-center">{meal.cafeDaManha}</TableCell>
                  <TableCell className="text-center">{meal.almoco}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="px-4 pb-4 pt-2 text-xs text-muted-foreground">
            Equipe técnica considerada: {project?.equipeTecnica ?? 0} pessoas (configurável na edição
            do projeto).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
