import type { Prisma, PrismaClient } from "@prisma/client";

export type TxClient = Prisma.TransactionClient | PrismaClient;

export function idCurtoFrom(name: string): string {
  const letters = name.replace(/[^A-Za-zÀ-ÿ]/g, "");
  return (letters.slice(0, 3) || "PER").toUpperCase();
}

/** Resolve o id do personagem pelo nome (normalizado), criando-o se necessário e permitido. */
export async function resolveCharacterId(
  tx: TxClient,
  projectId: string,
  name: string,
  criarPersonagens: boolean,
  characterIdByName: Map<string, string>,
  takenIdCurtos: Set<string>
): Promise<string | null> {
  const key = name.toUpperCase();
  if (characterIdByName.has(key)) return characterIdByName.get(key)!;

  if (!criarPersonagens) return null;

  let idCurto = idCurtoFrom(name);
  let suffix = 2;
  while (takenIdCurtos.has(idCurto)) {
    idCurto = `${idCurtoFrom(name)}${suffix}`;
    suffix += 1;
  }
  takenIdCurtos.add(idCurto);

  // Nunca infere a categoria a partir do roteiro — sempre entra como PRINCIPAL,
  // o usuário ajusta depois na página de Elenco se necessário.
  const created = await tx.character.create({
    data: { projectId, idCurto, categoria: "PRINCIPAL", personagem: name },
  });
  characterIdByName.set(key, created.id);
  return created.id;
}
