"use client";

import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useState } from "react";

import { InfoBanner } from "@/components/shared/info-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, sumTotals } from "@/lib/budget-calc";
import { cn } from "@/lib/utils";

import { ActualRow } from "./actual-row";
import { NewActualDialog } from "./new-actual-dialog";
import { ProgressBar } from "./progress-bar";
import type { AccountData, BudgetData } from "./types";

type AccountSummary = {
  account: AccountData;
  orcado: number;
  realizado: number;
  saldo: number;
  percentual: number;
};

export function AcompanhamentoTab({ projectId, budget }: { projectId: string; budget: BudgetData }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(accountId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  }

  const summaries: AccountSummary[] = budget.accountGroups.flatMap((group) =>
    group.accounts
      .map((account) => {
        const orcado = sumTotals(account.lineItems);
        const realizado = account.actuals.reduce((sum, a) => sum + a.valor, 0);
        return {
          account,
          orcado,
          realizado,
          saldo: orcado - realizado,
          percentual: orcado > 0 ? (realizado / orcado) * 100 : 0,
        };
      })
      .filter((s) => s.orcado > 0 || s.account.actuals.length > 0)
  );

  const totalOrcado = summaries.reduce((sum, s) => sum + s.orcado, 0);
  const totalRealizado = summaries.reduce((sum, s) => sum + s.realizado, 0);
  const saldoDisponivel = totalOrcado - totalRealizado;
  const percentExecutado = totalOrcado > 0 ? (totalRealizado / totalOrcado) * 100 : 0;

  const alertas = summaries.filter((s) => s.percentual >= 90);

  const allAccounts = budget.accountGroups.flatMap((g) =>
    g.accounts.map((a) => ({ id: a.id, codigo: a.codigo, nome: a.nome }))
  );

  return (
    <div className="space-y-4">
      <InfoBanner
        storageKey="budget-acompanhamento"
        title="Acompanhamento"
        description="Durante a filmagem, registre os gastos reais e compare com o orçado. Alertas automáticos avisam quando um departamento está próximo do limite."
      />
      <div className="grid grid-cols-4 gap-3">
        <SummaryCard label="Total Orçado" value={formatCurrency(totalOrcado, budget.moedaBase)} />
        <SummaryCard label="Total Realizado" value={formatCurrency(totalRealizado, budget.moedaBase)} />
        <SummaryCard label="Saldo Disponível" value={formatCurrency(saldoDisponivel, budget.moedaBase)} />
        <SummaryCard label="% Executado" value={`${percentExecutado.toFixed(1)}%`} />
      </div>

      {alertas.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="flex flex-col gap-2 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <AlertTriangle className="h-4 w-4" />
              Contas acima de 90% do orçado
            </div>
            <div className="flex flex-wrap gap-2">
              {alertas.map((s) => (
                <span
                  key={s.account.id}
                  className="rounded-md border border-amber-300 bg-amber-100 px-2 py-1 text-xs text-amber-900"
                >
                  {s.account.codigo} — {s.account.nome} ({s.percentual.toFixed(0)}%)
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Acompanhamento por conta</CardTitle>
          <NewActualDialog projectId={projectId} accounts={allAccounts} />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Código</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead className="text-right">Orçado</TableHead>
                <TableHead className="text-right">Realizado</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="w-40">% Gasto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaries.map((s) => {
                const isExpanded = expanded.has(s.account.id);
                return (
                  <Fragment key={s.account.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => toggle(s.account.id)}
                    >
                      <TableCell className="text-muted-foreground">{s.account.codigo}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 font-medium">
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                          {s.account.nome}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(s.orcado, budget.moedaBase)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(s.realizado, budget.moedaBase)}</TableCell>
                      <TableCell
                        className={cn("text-right", s.saldo < 0 && "font-medium text-destructive")}
                      >
                        {formatCurrency(s.saldo, budget.moedaBase)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ProgressBar percent={s.percentual} />
                          <span className="w-10 shrink-0 text-xs text-muted-foreground">
                            {s.percentual.toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/20 p-0">
                          <div className="p-3">
                            {s.account.actuals.length === 0 ? (
                              <p className="text-xs text-muted-foreground">Nenhum lançamento ainda.</p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Descrição</TableHead>
                                    <TableHead>Valor</TableHead>
                                    <TableHead className="w-16">Ações</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {s.account.actuals.map((actual) => (
                                    <ActualRow key={actual.id} projectId={projectId} actual={actual} />
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
              {summaries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-4 text-center text-sm text-muted-foreground">
                    Nenhuma conta com orçamento ou lançamentos ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
