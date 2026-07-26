"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { InfoBanner } from "@/components/shared/info-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { computeScenarioTotals, formatCurrency, resolveScenarioGlobalValues } from "@/lib/budget-calc";
import { cn } from "@/lib/utils";

import { NewScenarioDialog } from "./new-scenario-dialog";
import { ACCOUNT_GROUP_TYPE_LABEL } from "./types";
import type { BudgetData, ScenarioData } from "./types";

export function ScenariosTab({ projectId, budget }: { projectId: string; budget: BudgetData }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const scenarios = [...budget.scenarios].sort((a, b) => {
    if (a.isBase !== b.isBase) return a.isBase ? -1 : 1;
    return a.nome.localeCompare(b.nome);
  });

  const totalsByScenario = new Map(
    scenarios.map((scenario) => [
      scenario.id,
      computeScenarioTotals({
        accountGroups: budget.accountGroups,
        fringes: budget.fringes,
        contingenciaPercentual: budget.contingenciaPercentual,
        globalValues: resolveScenarioGlobalValues(budget, scenario),
      }),
    ])
  );

  const baseScenario = scenarios.find((s) => s.isBase);
  const baseTotals = baseScenario ? totalsByScenario.get(baseScenario.id) : undefined;

  async function handleSetBase(scenarioId: string) {
    setBusyId(scenarioId);
    await fetch(`/api/projects/${projectId}/budget/scenarios/${scenarioId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isBase: true }),
    });
    setBusyId(null);
    router.refresh();
  }

  async function handleDelete(scenarioId: string) {
    await fetch(`/api/projects/${projectId}/budget/scenarios/${scenarioId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <InfoBanner
        storageKey="budget-cenarios"
        title="Cenários"
        description="Compare versões do orçamento alterando variáveis. Ex: Cenário A com 5 dias de set vs Cenário B com 7 dias. O sistema calcula o impacto financeiro de cada decisão sem alterar o orçamento aprovado."
      />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Cenários</CardTitle>
          <NewScenarioDialog projectId={projectId} globals={budget.globals} />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Grand Total</TableHead>
                <TableHead className="w-40">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scenarios.map((scenario) => {
                const totals = totalsByScenario.get(scenario.id)!;
                return (
                  <TableRow key={scenario.id} className={busyId === scenario.id ? "opacity-60" : undefined}>
                    <TableCell className="font-medium">{scenario.nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{scenario.notas || "—"}</TableCell>
                    <TableCell>
                      {scenario.isBase && <Badge>Base</Badge>}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(totals.grandTotal, budget.moedaBase)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {!scenario.isBase && (
                          <Button variant="outline" size="sm" onClick={() => handleSetBase(scenario.id)}>
                            Usar como base
                          </Button>
                        )}
                        {!scenario.isBase && (
                          <ConfirmDeleteDialog
                            title={`Excluir "${scenario.nome}"?`}
                            description="Remove o cenário e seus overrides de Globals. Não pode ser desfeita."
                            onConfirm={() => handleDelete(scenario.id)}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {scenarios.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-4 text-center text-sm text-muted-foreground">
                    Nenhum cenário ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {scenarios.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comparação lado a lado</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grupo / Total</TableHead>
                  {scenarios.map((s) => (
                    <TableHead key={s.id} className="text-right">
                      {s.nome}
                      {s.isBase && " (base)"}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {budget.accountGroups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell>
                      {group.codigo} — {ACCOUNT_GROUP_TYPE_LABEL[group.tipo]}
                    </TableCell>
                    {scenarios.map((scenario) => {
                      const value = totalsByScenario.get(scenario.id)!.groupTotals.get(group.id) ?? 0;
                      const baseValue = baseTotals?.groupTotals.get(group.id) ?? 0;
                      const differs = !scenario.isBase && value !== baseValue;
                      return (
                        <TableCell
                          key={scenario.id}
                          className={cn("text-right", differs && "bg-amber-100 font-medium text-amber-900")}
                        >
                          {formatCurrency(value, budget.moedaBase)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}

                <ComparisonTotalRow
                  label="Total ATL"
                  scenarios={scenarios}
                  totalsByScenario={totalsByScenario}
                  baseTotals={baseTotals}
                  moedaBase={budget.moedaBase}
                  field="totalATL"
                />
                <ComparisonTotalRow
                  label="Total BTL"
                  scenarios={scenarios}
                  totalsByScenario={totalsByScenario}
                  baseTotals={baseTotals}
                  moedaBase={budget.moedaBase}
                  field="totalBTL"
                />
                <ComparisonTotalRow
                  label="Total Fringes"
                  scenarios={scenarios}
                  totalsByScenario={totalsByScenario}
                  baseTotals={baseTotals}
                  moedaBase={budget.moedaBase}
                  field="totalFringes"
                />
                <ComparisonTotalRow
                  label="Contingência"
                  scenarios={scenarios}
                  totalsByScenario={totalsByScenario}
                  baseTotals={baseTotals}
                  moedaBase={budget.moedaBase}
                  field="contingencia"
                />
                <ComparisonTotalRow
                  label="GRAND TOTAL"
                  scenarios={scenarios}
                  totalsByScenario={totalsByScenario}
                  baseTotals={baseTotals}
                  moedaBase={budget.moedaBase}
                  field="grandTotal"
                  emphasized
                />

                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell>Δ vs. base</TableCell>
                  {scenarios.map((scenario) => {
                    const totals = totalsByScenario.get(scenario.id)!;
                    const delta = baseTotals ? totals.grandTotal - baseTotals.grandTotal : 0;
                    return (
                      <TableCell key={scenario.id} className="text-right">
                        {scenario.isBase
                          ? "—"
                          : `${delta >= 0 ? "+" : ""}${formatCurrency(delta, budget.moedaBase)}`}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ComparisonTotalRow({
  label,
  scenarios,
  totalsByScenario,
  baseTotals,
  moedaBase,
  field,
  emphasized,
}: {
  label: string;
  scenarios: ScenarioData[];
  totalsByScenario: Map<string, ReturnType<typeof computeScenarioTotals>>;
  baseTotals: ReturnType<typeof computeScenarioTotals> | undefined;
  moedaBase: string;
  field: "totalATL" | "totalBTL" | "totalFringes" | "contingencia" | "grandTotal";
  emphasized?: boolean;
}) {
  return (
    <TableRow className={emphasized ? "font-semibold" : undefined}>
      <TableCell>{label}</TableCell>
      {scenarios.map((scenario) => {
        const totals = totalsByScenario.get(scenario.id)!;
        const value = totals[field];
        const baseValue = baseTotals?.[field] ?? 0;
        const differs = !scenario.isBase && value !== baseValue;
        return (
          <TableCell
            key={scenario.id}
            className={cn("text-right", differs && "bg-amber-100 font-medium text-amber-900")}
          >
            {formatCurrency(value, moedaBase)}
          </TableCell>
        );
      })}
    </TableRow>
  );
}
