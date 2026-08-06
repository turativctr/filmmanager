import type { Prisma } from "@prisma/client";

import { normalizeLocacaoNome } from "@/lib/locacao";

type Tx = Prisma.TransactionClient;

/** Resolve (ou cria) a Locacao correspondente a um valor de Set, dentro de uma transação de import
 *  de roteiro — NUNCA recria nem reponta locações já existentes: o trabalho de dividir e unificar
 *  que o AD já fez não pode ser desfeito por uma reimportação. Se o set já tem uma locação vinculada
 *  (por qualquer cena existente do projeto, de um import anterior), reutiliza essa MESMA locação.
 *  Senão, cria uma nova (nome = set, sem endereço) — só uma vez por set dentro desta chamada, via o
 *  cache local `setToLocacaoId` (compartilhado entre todas as cenas do mesmo import). */
export async function resolveLocacaoIdForSet(
  tx: Tx,
  projectId: string,
  set: string | null,
  setToLocacaoId: Map<string, string>
): Promise<string | null> {
  if (!set) return null;

  const cached = setToLocacaoId.get(set);
  if (cached) return cached;

  const existingScene = await tx.scene.findFirst({
    where: { projectId, set, locacaoId: { not: null } },
    select: { locacaoId: true },
  });
  if (existingScene?.locacaoId) {
    setToLocacaoId.set(set, existingScene.locacaoId);
    return existingScene.locacaoId;
  }

  const created = await tx.locacao.create({ data: { projectId, nome: normalizeLocacaoNome(set) } });
  setToLocacaoId.set(set, created.id);
  return created.id;
}

/** Variante usada quando o roteiro já distingue set de locação (import de PDF, convenção
 *  "LOCAL; SET" — ver pdf-script-parser.ts): resolve pelo NOME da locação em vez do valor de
 *  set, já que vários sets diferentes ("SALA", "COZINHA") devem cair na MESMA locação ("CASA").
 *  A checagem de reuso busca por nome (não por scene.set, que aqui é só o cômodo) — mesma regra
 *  de nunca recriar/repontar uma locação já existente. */
export async function resolveLocacaoIdByNome(
  tx: Tx,
  projectId: string,
  locacaoNome: string | null,
  nomeToLocacaoId: Map<string, string>
): Promise<string | null> {
  if (!locacaoNome) return null;
  const nome = normalizeLocacaoNome(locacaoNome);

  const cached = nomeToLocacaoId.get(nome);
  if (cached) return cached;

  const existing = await tx.locacao.findFirst({ where: { projectId, nome } });
  if (existing) {
    nomeToLocacaoId.set(nome, existing.id);
    return existing.id;
  }

  const created = await tx.locacao.create({ data: { projectId, nome } });
  nomeToLocacaoId.set(nome, created.id);
  return created.id;
}
