import { prisma } from "@/lib/prisma";

export async function findOwnedProject(projectId: string, userId: string) {
  return prisma.project.findFirst({ where: { id: projectId, ownerId: userId } });
}
