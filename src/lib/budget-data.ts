import type { BudgetData } from "@/components/budget/types";
import { prisma } from "@/lib/prisma";

export async function getBudgetData(projectId: string): Promise<BudgetData | null> {
  const budget = await prisma.budget.findUnique({
    where: { projectId },
    include: {
      accountGroups: {
        orderBy: { ordem: "asc" },
        include: {
          accounts: {
            orderBy: { ordem: "asc" },
            include: {
              lineItems: { orderBy: { ordem: "asc" } },
              actuals: { orderBy: { data: "asc" } },
            },
          },
        },
      },
      globals: { orderBy: { chave: "asc" } },
      fringes: { orderBy: { nome: "asc" }, include: { fringeLineItems: true } },
      scenarios: { orderBy: { nome: "asc" }, include: { overrides: true } },
    },
  });

  if (!budget) return null;

  return {
    id: budget.id,
    moedaBase: budget.moedaBase,
    versao: budget.versao,
    contingenciaPercentual: Number(budget.contingenciaPercentual),
    notas: budget.notas,
    accountGroups: budget.accountGroups.map((group) => ({
      id: group.id,
      codigo: group.codigo,
      nome: group.nome,
      tipo: group.tipo,
      ordem: group.ordem,
      accounts: group.accounts.map((account) => ({
        id: account.id,
        groupId: account.groupId,
        codigo: account.codigo,
        nome: account.nome,
        ordem: account.ordem,
        lineItems: account.lineItems.map((li) => ({
          id: li.id,
          accountId: li.accountId,
          descricao: li.descricao,
          quantidade: Number(li.quantidade),
          unidade: li.unidade,
          periodo: Number(li.periodo),
          taxa: Number(li.taxa),
          moeda: li.moeda,
          taxaCambio: Number(li.taxaCambio),
          total: Number(li.total),
          isFrengeable: li.isFrengeable,
          globalRef: li.globalRef,
          ordem: li.ordem,
        })),
        actuals: account.actuals.map((a) => ({
          id: a.id,
          accountId: a.accountId,
          descricao: a.descricao,
          valor: Number(a.valor),
          data: a.data.toISOString(),
          notas: a.notas,
        })),
      })),
    })),
    globals: budget.globals.map((g) => ({
      id: g.id,
      chave: g.chave,
      valor: Number(g.valor),
      descricao: g.descricao,
      afetaLinhas: g.afetaLinhas,
    })),
    fringes: budget.fringes.map((f) => ({
      id: f.id,
      nome: f.nome,
      percentual: Number(f.percentual),
      teto: f.teto != null ? Number(f.teto) : null,
      aplicaEm: f.aplicaEm,
      tipo: f.tipo,
      fringeLineItems: f.fringeLineItems.map((fli) => ({
        id: fli.id,
        accountId: fli.accountId,
        base: Number(fli.base),
        valor: Number(fli.valor),
      })),
    })),
    scenarios: budget.scenarios.map((s) => ({
      id: s.id,
      nome: s.nome,
      notas: s.notas,
      isBase: s.isBase,
      overrides: s.overrides.map((o) => ({ id: o.id, chave: o.chave, valor: Number(o.valor) })),
    })),
  };
}
