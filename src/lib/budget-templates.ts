import type { AccountGroupType, Prisma, PrismaClient } from "@prisma/client";

type TxClient = Prisma.TransactionClient | PrismaClient;

type AccountTemplate = { codigo: string; nome: string };
type GroupTemplate = { codigo: string; nome: string; tipo: AccountGroupType; accounts: AccountTemplate[] };

/** Baseado nos departamentos reais usados em Ressaca e Viageiro. */
export const CURTA_METRAGEM_TEMPLATE: GroupTemplate[] = [
  {
    codigo: "1",
    nome: "ATL",
    tipo: "ATL",
    accounts: [
      { codigo: "1000", nome: "Roteiro e história" },
      { codigo: "1100", nome: "Direção" },
      { codigo: "1200", nome: "Elenco principal" },
    ],
  },
  {
    codigo: "2",
    nome: "BTL — Produção",
    tipo: "BTL_PRODUCAO",
    accounts: [
      { codigo: "2000", nome: "Produção executiva e coordenação" },
      { codigo: "2100", nome: "Câmera e fotografia" },
      { codigo: "2200", nome: "Arte e cenografia" },
      { codigo: "2300", nome: "Figurino" },
      { codigo: "2400", nome: "Maquiagem e efeitos" },
      { codigo: "2500", nome: "Som direto" },
      { codigo: "2600", nome: "Elétrica e maquinária" },
      { codigo: "2700", nome: "Locação" },
      { codigo: "2800", nome: "Transporte" },
      { codigo: "2900", nome: "Alimentação (catering)" },
      { codigo: "2950", nome: "Comida de cena" },
      { codigo: "2980", nome: "Figuração" },
      { codigo: "2990", nome: "Diversos produção" },
    ],
  },
  {
    codigo: "3",
    nome: "BTL — Pós-produção",
    tipo: "BTL_POS",
    accounts: [
      { codigo: "3000", nome: "Montagem" },
      { codigo: "3100", nome: "Finalização e colorização (DI)" },
      { codigo: "3200", nome: "Som pós e música" },
      { codigo: "3300", nome: "VFX e efeitos especiais" },
      { codigo: "3400", nome: "Entrega e cópias" },
    ],
  },
];

export async function populateBudgetTemplate(tx: TxClient, budgetId: string) {
  let groupOrdem = 0;
  for (const group of CURTA_METRAGEM_TEMPLATE) {
    const createdGroup = await tx.accountGroup.create({
      data: {
        budgetId,
        codigo: group.codigo,
        nome: group.nome,
        tipo: group.tipo,
        ordem: groupOrdem++,
      },
    });

    let accountOrdem = 0;
    for (const account of group.accounts) {
      await tx.budgetAccount.create({
        data: {
          budgetId,
          groupId: createdGroup.id,
          codigo: account.codigo,
          nome: account.nome,
          ordem: accountOrdem++,
        },
      });
    }
  }
}
