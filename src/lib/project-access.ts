import type { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** Ponto único de controle de acesso a projeto. `role` é obrigatório (não opcional) de propósito:
 *  qualquer chamada não migrada pra passar session.user.role vira erro de TypeScript, em vez de
 *  silenciosamente manter o comportamento antigo. ADMIN enxerga qualquer projeto, inclusive órfãos
 *  (ownerId null) — USER continua restrito aos próprios. */
export async function findOwnedProject(projectId: string, userId: string, role: Role) {
  if (role === "ADMIN") {
    return prisma.project.findFirst({ where: { id: projectId } });
  }
  return prisma.project.findFirst({ where: { id: projectId, ownerId: userId } });
}
