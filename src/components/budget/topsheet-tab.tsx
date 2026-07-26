"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";

import { InfoBanner } from "@/components/shared/info-banner";
import { TermTooltip } from "@/components/shared/term-tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { computeBudgetTotals, formatCurrency, isATL, sumTotals } from "@/lib/budget-calc";
import { cn } from "@/lib/utils";

import { ExportDropdown } from "./export-dropdown";
import { ACCOUNT_GROUP_TYPE_LABEL } from "./types";
import type { AccountGroupData, BudgetData } from "./types";

function groupTotal(group: AccountGroupData): number {
  return sumTotals(group.accounts.flatMap((account) => account.lineItems));
}

export function TopsheetTab({
  projectId,
  budget,
  projeto,
}: {
  projectId: string;
  budget: BudgetData;
  projeto: { titulo: string; sigla: string | null };
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggle(groupId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  const totalATL = sumTotals(
    budget.accountGroups
      .filter((g) => isATL(g.tipo))
      .flatMap((g) => g.accounts.flatMap((a) => a.lineItems))
  );
  const totalBTL = sumTotals(
    budget.accountGroups
      .filter((g) => !isATL(g.tipo))
      .flatMap((g) => g.accounts.flatMap((a) => a.lineItems))
  );
  const totalFringes = budget.fringes
    .flatMap((f) => f.fringeLineItems)
    .reduce((sum, fli) => sum + fli.valor, 0);
  const totals = computeBudgetTotals({
    totalATL,
    totalBTL,
    totalFringes,
    contingenciaPercentual: budget.contingenciaPercentual,
  });

  return (
    <div className="space-y-4">
      <InfoBanner
        storageKey="budget-topsheet"
        title="Orçamento"
        description="Gerencie os custos da produção por departamento. O Resumo mostra o total executivo. O módulo Detalhado lista cada item de custo. Globais são variáveis que atualizam múltiplas linhas ao mesmo tempo."
      />
      <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Moeda base: <span className="font-medium text-foreground">{budget.moedaBase}</span>
          </p>
          <ExportDropdown
            projectId={projectId}
            scenarioCount={budget.scenarios.length}
            projeto={projeto}
            versao={budget.versao}
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Código</TableHead>
              <TableHead>Categoria / Departamento</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {budget.accountGroups.map((group) => {
              const total = groupTotal(group);
              const isCollapsed = collapsed.has(group.id);
              return (
                <Fragment key={group.id}>
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell colSpan={2}>
                      <button
                        type="button"
                        className="flex items-center gap-1.5"
                        onClick={() => toggle(group.id)}
                      >
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                        {group.codigo} — {ACCOUNT_GROUP_TYPE_LABEL[group.tipo]}
                      </button>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(total, budget.moedaBase)}</TableCell>
                  </TableRow>
                  {!isCollapsed &&
                    group.accounts.map((account) => {
                      const accountTotal = sumTotals(account.lineItems);
                      return (
                        <TableRow key={account.id}>
                          <TableCell className="pl-8 text-muted-foreground">{account.codigo}</TableCell>
                          <TableCell>{account.nome}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(accountTotal, budget.moedaBase)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>

        <div className="space-y-1 border-t pt-3">
          <TotalsRow
            label={
              <span className="inline-flex items-center gap-1">
                Total ATL
                <TermTooltip content="Above the Line (direção, roteiro, elenco principal) e Below the Line (equipe técnica, locação, pós-produção)." />
              </span>
            }
            value={totals.totalATL}
            moeda={budget.moedaBase}
          />
          <TotalsRow label="Total BTL" value={totals.totalBTL} moeda={budget.moedaBase} />
          <TotalsRow label="Total Fringes" value={totals.totalFringes} moeda={budget.moedaBase} />
          <TotalsRow
            label={`Contingência (${budget.contingenciaPercentual}% sobre BTL)`}
            value={totals.contingencia}
            moeda={budget.moedaBase}
          />
          <TotalsRow label="GRAND TOTAL" value={totals.grandTotal} moeda={budget.moedaBase} grand />
        </div>
      </CardContent>
      </Card>
    </div>
  );
}

function TotalsRow({
  label,
  value,
  moeda,
  grand,
}: {
  label: ReactNode;
  value: number;
  moeda: string;
  grand?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-2 py-1.5 text-sm",
        grand && "rounded-md bg-secondary text-base font-bold text-secondary-foreground"
      )}
    >
      <span className={cn(!grand && "text-muted-foreground")}>{label}</span>
      <span className={cn("font-semibold", grand && "font-bold")}>{formatCurrency(value, moeda)}</span>
    </div>
  );
}
