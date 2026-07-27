import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { recalcLineItemsForGlobal } from "@/lib/budget-server";
import { findOwnedProject } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { globalSchema } from "@/lib/validation/budget";

async function loadGlobal(projectId: string, globalId: string) {
  return prisma.global.findFirst({
    where: { id: globalId, budget: { projectId } },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; globalId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const global = await loadGlobal(params.id, params.globalId);
  if (!global) return NextResponse.json({ error: "Global não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = globalSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.global.update({ where: { id: global.id }, data: parsed.data });
    await recalcLineItemsForGlobal(tx, global.budgetId, saved);
    return saved;
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; globalId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const global = await loadGlobal(params.id, params.globalId);
  if (!global) return NextResponse.json({ error: "Global não encontrado." }, { status: 404 });

  await prisma.global.delete({ where: { id: global.id } });

  return NextResponse.json({ ok: true });
}
