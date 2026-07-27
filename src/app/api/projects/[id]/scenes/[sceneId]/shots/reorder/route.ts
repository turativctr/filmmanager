import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { recalculateScene } from "@/lib/shots";
import { shotReorderSchema } from "@/lib/validation/shot";

export async function POST(request: Request, { params }: { params: { id: string; sceneId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const scene = await prisma.scene.findFirst({ where: { id: params.sceneId, projectId: params.id } });
  if (!scene) return NextResponse.json({ error: "Cena não encontrada." }, { status: 404 });

  const body = await request.json();
  const parsed = shotReorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { order } = parsed.data;
  const existing = await prisma.shot.findMany({ where: { sceneId: scene.id }, select: { id: true } });
  const existingIds = new Set(existing.map((s) => s.id));

  if (order.length !== existingIds.size || !order.every((id) => existingIds.has(id))) {
    return NextResponse.json({ error: "Lista de planos não corresponde aos planos desta cena." }, { status: 400 });
  }

  // Duas fases (offset negativo, depois posição final) — evita colisão com a constraint
  // única (sceneId, ordem) ao trocar planos de posição, sem precisar apagar e recriar linhas.
  await prisma.$transaction([
    ...order.map((shotId, index) => prisma.shot.update({ where: { id: shotId }, data: { ordem: -(index + 1) } })),
    ...order.map((shotId, index) => prisma.shot.update({ where: { id: shotId }, data: { ordem: index + 1 } })),
  ]);

  const shots = await recalculateScene(scene.id);

  return NextResponse.json(shots);
}
