import type { AccountGroupType } from "@prisma/client";

import type { AccountGroupData, BudgetData, FringeData, ScenarioData } from "@/components/budget/types";

/** Todos os valores monetários/decimais do Prisma chegam como Decimal — convertemos para number cedo, igual a lib/paginas.ts. */
export function toNumber(value: unknown): number {
  const num = Number(value?.toString() ?? 0);
  return Number.isFinite(num) ? num : 0;
}

export type LineItemCalcInput = {
  quantidade: number;
  periodo: number;
  taxa: number;
  taxaCambio: number;
};

export function computeLineItemTotal({ quantidade, periodo, taxa, taxaCambio }: LineItemCalcInput): number {
  return quantidade * periodo * taxa * taxaCambio;
}

/** Se globalRef aponta para um Global existente, o valor do Global substitui o período salvo. */
export function resolveEffectivePeriodo(
  periodoSalvo: number,
  globalRef: string | null | undefined,
  globalValues: Map<string, number>
): number {
  if (globalRef && globalValues.has(globalRef)) return globalValues.get(globalRef)!;
  return periodoSalvo;
}

export function sumTotals(items: { total: number }[]): number {
  return items.reduce((sum, item) => sum + item.total, 0);
}

export function isATL(tipo: AccountGroupType): boolean {
  return tipo === "ATL";
}

export function isBTL(tipo: AccountGroupType): boolean {
  return tipo === "BTL_PRODUCAO" || tipo === "BTL_POS" || tipo === "OUTROS";
}

/** Base respeita o teto (cutoff máximo de base de cálculo) antes de aplicar o percentual. */
export function computeFringeValue(base: number, percentual: number, teto: number | null): number {
  const baseAplicada = teto != null ? Math.min(base, teto) : base;
  return baseAplicada * (percentual / 100);
}

export type BudgetTotals = {
  totalATL: number;
  totalBTL: number;
  totalFringes: number;
  contingencia: number;
  grandTotal: number;
};

/** Contingência incide apenas sobre o total BTL, não sobre ATL. */
export function computeBudgetTotals({
  totalATL,
  totalBTL,
  totalFringes,
  contingenciaPercentual,
}: {
  totalATL: number;
  totalBTL: number;
  totalFringes: number;
  contingenciaPercentual: number;
}): BudgetTotals {
  const contingencia = totalBTL * (contingenciaPercentual / 100);
  const grandTotal = totalATL + totalBTL + totalFringes + contingencia;
  return { totalATL, totalBTL, totalFringes, contingencia, grandTotal };
}

export function formatCurrency(value: number, moeda: string = "BRL"): string {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: moeda }).format(value);
  } catch {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }
}

/** Resolve aplicaEm (mistura de ids de AccountGroup e BudgetAccount) para o conjunto de ids de conta afetados. */
export function resolveAplicaEmToAccountIds(aplicaEm: string[], accountGroups: AccountGroupData[]): string[] {
  const groupIds = new Set(accountGroups.map((g) => g.id));
  const accountIdsFromGroups = accountGroups
    .filter((g) => aplicaEm.includes(g.id))
    .flatMap((g) => g.accounts.map((a) => a.id));
  const directAccountIds = aplicaEm.filter((id) => !groupIds.has(id));
  return [...new Set([...directAccountIds, ...accountIdsFromGroups])];
}

export type ScenarioTotals = BudgetTotals & {
  groupTotals: Map<string, number>;
};

/**
 * Recalcula os totais do orçamento inteiro em memória, substituindo os valores dos Globals
 * pelos overrides de um cenário (quando existirem). Não lê nem escreve nada no banco — os
 * LineItems/Fringes já devem estar carregados (mesmos dados usados no Topsheet/Detalhado).
 */
export function computeScenarioTotals({
  accountGroups,
  fringes,
  contingenciaPercentual,
  globalValues,
}: {
  accountGroups: AccountGroupData[];
  fringes: FringeData[];
  contingenciaPercentual: number;
  globalValues: Map<string, number>;
}): ScenarioTotals {
  const groupTotals = new Map<string, number>();
  const accountFringeableTotals = new Map<string, number>();

  for (const group of accountGroups) {
    let groupTotal = 0;
    for (const account of group.accounts) {
      let fringeableTotal = 0;
      for (const item of account.lineItems) {
        const effectivePeriodo = resolveEffectivePeriodo(item.periodo, item.globalRef, globalValues);
        const total = computeLineItemTotal({
          quantidade: item.quantidade,
          periodo: effectivePeriodo,
          taxa: item.taxa,
          taxaCambio: item.taxaCambio,
        });
        groupTotal += total;
        if (item.isFrengeable) fringeableTotal += total;
      }
      accountFringeableTotals.set(account.id, fringeableTotal);
    }
    groupTotals.set(group.id, groupTotal);
  }

  let totalFringes = 0;
  for (const fringe of fringes) {
    const accountIds = resolveAplicaEmToAccountIds(fringe.aplicaEm, accountGroups);
    for (const accountId of accountIds) {
      const base = accountFringeableTotals.get(accountId) ?? 0;
      if (base <= 0) continue;
      totalFringes += computeFringeValue(base, fringe.percentual, fringe.teto);
    }
  }

  const totalATL = accountGroups
    .filter((g) => isATL(g.tipo))
    .reduce((sum, g) => sum + (groupTotals.get(g.id) ?? 0), 0);
  const totalBTL = accountGroups
    .filter((g) => !isATL(g.tipo))
    .reduce((sum, g) => sum + (groupTotals.get(g.id) ?? 0), 0);

  return {
    groupTotals,
    ...computeBudgetTotals({ totalATL, totalBTL, totalFringes, contingenciaPercentual }),
  };
}

/**
 * Globals efetivos para um cenário: o cenário base sempre usa os Globals reais/atuais do
 * orçamento (garante que "base" nunca diverge do Topsheet real); cenários alternativos partem
 * dos mesmos Globals reais e sobrescrevem apenas as chaves que definiram um override.
 */
export function resolveScenarioGlobalValues(budget: BudgetData, scenario: ScenarioData): Map<string, number> {
  const values = new Map(budget.globals.map((g) => [g.chave, g.valor]));
  if (!scenario.isBase) {
    for (const override of scenario.overrides) {
      values.set(override.chave, override.valor);
    }
  }
  return values;
}
