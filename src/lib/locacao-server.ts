import { prisma } from "@/lib/prisma";
import { normalizeEndereco } from "@/lib/locacao";

/** Compara o endereço (normalizado) contra as outras locações do projeto — usado só pra SUGERIR
 *  unificação ao salvar um endereço, nunca pra unificar sozinho (ver rota de locações). */
export async function findAddressDuplicates(
  projectId: string,
  endereco: string,
  excludeId?: string
): Promise<{ id: string; nome: string }[]> {
  const normalized = normalizeEndereco(endereco);
  if (!normalized) return [];

  const others = await prisma.locacao.findMany({
    where: { projectId, id: excludeId ? { not: excludeId } : undefined, endereco: { not: null } },
    select: { id: true, nome: true, endereco: true },
  });

  return others
    .filter((o) => o.endereco && normalizeEndereco(o.endereco) === normalized)
    .map((o) => ({ id: o.id, nome: o.nome }));
}
