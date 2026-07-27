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
