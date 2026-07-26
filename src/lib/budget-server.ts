import type { Prisma, PrismaClient } from "@prisma/client";

import { computeFringeValue, computeLineItemTotal, sumTotals, toNumber } from "@/lib/budget-calc";

type TxClient = Prisma.TransactionClient | PrismaClient;

export type LineItemSaveInput = {
  accountId: string;
  scenarioId?: string | null;
  descricao: string;
  quantidade: number;
  unidade: string;
  periodo: number;
  taxa: number;
  moeda: string;
  taxaCambio: number;
  isFrengeable: boolean;
  globalRef: string | null;
  notas: string | null;
  ordem: number;
};

/** Cria ou atualiza um LineItem, resolvendo o período efetivo via Global (se globalRef definido) e mantendo Global.afetaLinhas em sincronia. Recalcula os Fringes do orçamento em seguida, já que a base de cálculo pode ter mudado. */
export async function saveLineItemWithCalc(
  tx: TxClient,
  budgetId: string,
  lineItemId: string | null,
  data: LineItemSaveInput
) {
  let effectivePeriodo = data.periodo;
  let resolvedGlobalId: string | null = null;

  if (data.globalRef) {
    const global = await tx.global.findFirst({ where: { budgetId, chave: data.globalRef } });
    if (global) {
      effectivePeriodo = toNumber(global.valor);
      resolvedGlobalId = global.id;
    }
  }

  const total = computeLineItemTotal({
    quantidade: data.quantidade,
    periodo: effectivePeriodo,
    taxa: data.taxa,
    taxaCambio: data.taxaCambio,
  });

  const payload = { ...data, budgetId, periodo: effectivePeriodo, total };

  const saved = lineItemId
    ? await tx.lineItem.update({ where: { id: lineItemId }, data: payload })
    : await tx.lineItem.create({ data: payload });

  await syncGlobalReferences(tx, budgetId, saved.id, resolvedGlobalId);
  await recalcAllFringesForBudget(tx, budgetId);

  return saved;
}

export async function deleteLineItemWithCalc(tx: TxClient, budgetId: string, lineItemId: string) {
  await tx.lineItem.delete({ where: { id: lineItemId } });
  await syncGlobalReferences(tx, budgetId, lineItemId, null);
  await recalcAllFringesForBudget(tx, budgetId);
}

/** Garante que apenas o Global correto (se houver) referencie este LineItem em afetaLinhas. */
async function syncGlobalReferences(
  tx: TxClient,
  budgetId: string,
  lineItemId: string,
  resolvedGlobalId: string | null
) {
  const globals = await tx.global.findMany({ where: { budgetId } });
  for (const global of globals) {
    const shouldContain = global.id === resolvedGlobalId;
    const contains = global.afetaLinhas.includes(lineItemId);
    if (shouldContain && !contains) {
      await tx.global.update({
        where: { id: global.id },
        data: { afetaLinhas: [...global.afetaLinhas, lineItemId] },
      });
    } else if (!shouldContain && contains) {
      await tx.global.update({
        where: { id: global.id },
        data: { afetaLinhas: global.afetaLinhas.filter((id) => id !== lineItemId) },
      });
    }
  }
}

/** Recalcula o período/total de todos os LineItems vinculados a um Global (chamado após editar o valor do Global). */
export async function recalcLineItemsForGlobal(
  tx: TxClient,
  budgetId: string,
  global: { valor: unknown; afetaLinhas: string[] }
) {
  const novoPeriodo = toNumber(global.valor);
  const items = await tx.lineItem.findMany({ where: { id: { in: global.afetaLinhas } } });
  for (const item of items) {
    const total = computeLineItemTotal({
      quantidade: toNumber(item.quantidade),
      periodo: novoPeriodo,
      taxa: toNumber(item.taxa),
      taxaCambio: toNumber(item.taxaCambio),
    });
    await tx.lineItem.update({ where: { id: item.id }, data: { periodo: novoPeriodo, total } });
  }
  await recalcAllFringesForBudget(tx, budgetId);
}

/** Resolve aplicaEm (mistura de ids de AccountGroup e BudgetAccount) para o conjunto de contas afetadas, recria os FringeLineItems desse Fringe. */
export async function recalcFringeLineItems(
  tx: TxClient,
  budgetId: string,
  fringe: { id: string; percentual: unknown; teto: unknown; aplicaEm: string[] }
) {
  const groups = await tx.accountGroup.findMany({
    where: { budgetId, id: { in: fringe.aplicaEm } },
    include: { accounts: true },
  });
  const groupAccountIds = groups.flatMap((g) => g.accounts.map((a) => a.id));
  const directAccountIds = fringe.aplicaEm.filter((id) => !groups.some((g) => g.id === id));
  const accountIds = [...new Set([...directAccountIds, ...groupAccountIds])];

  await tx.fringeLineItem.deleteMany({ where: { fringeId: fringe.id } });

  const percentual = toNumber(fringe.percentual);
  const teto = fringe.teto != null ? toNumber(fringe.teto) : null;

  for (const accountId of accountIds) {
    const items = await tx.lineItem.findMany({ where: { accountId, isFrengeable: true } });
    const base = sumTotals(items.map((i) => ({ total: toNumber(i.total) })));
    if (base <= 0) continue;
    const valor = computeFringeValue(base, percentual, teto);
    await tx.fringeLineItem.create({ data: { fringeId: fringe.id, budgetId, accountId, base, valor } });
  }
}

export async function recalcAllFringesForBudget(tx: TxClient, budgetId: string) {
  const fringes = await tx.fringe.findMany({ where: { budgetId } });
  for (const fringe of fringes) {
    await recalcFringeLineItems(tx, budgetId, fringe);
  }
}

/** Cria ou atualiza G_DIAS_SET/G_SEMANAS a partir da contagem real de ShootDays do projeto, recalculando LineItems vinculados. */
export async function syncSchedulingGlobals(tx: TxClient, projectId: string, budgetId: string) {
  const diasSet = await tx.shootDay.count({ where: { projectId } });
  const semanas = Math.ceil(diasSet / 5);

  const definitions: Array<{ chave: string; valor: number; descricao: string }> = [
    { chave: "G_DIAS_SET", valor: diasSet, descricao: "Número de dias de set" },
    { chave: "G_SEMANAS", valor: semanas, descricao: "Número de semanas de set (dias de set ÷ 5, arredondado para cima)" },
  ];

  for (const { chave, valor, descricao } of definitions) {
    const existing = await tx.global.findFirst({ where: { budgetId, chave } });
    if (existing) {
      await tx.global.update({ where: { id: existing.id }, data: { valor } });
      await recalcLineItemsForGlobal(tx, budgetId, { valor, afetaLinhas: existing.afetaLinhas });
    } else {
      await tx.global.create({ data: { budgetId, chave, valor, descricao, afetaLinhas: [] } });
    }
  }

  return { diasSet, semanas };
}
