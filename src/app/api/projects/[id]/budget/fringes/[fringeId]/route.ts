import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { recalcFringeLineItems } from "@/lib/budget-server";
import { findOwnedProject } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { fringeSchema } from "@/lib/validation/budget";

async function loadFringe(projectId: string, fringeId: string) {
  return prisma.fringe.findFirst({
    where: { id: fringeId, budget: { projectId } },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; fringeId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const fringe = await loadFringe(params.id, params.fringeId);
  if (!fringe) return NextResponse.json({ error: "Fringe não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = fringeSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.fringe.update({ where: { id: fringe.id }, data: parsed.data });
    await recalcFringeLineItems(tx, fringe.budgetId, saved);
    return saved;
  });

  const withLineItems = await prisma.fringe.findUnique({
    where: { id: updated.id },
    include: { fringeLineItems: true },
  });

  return NextResponse.json(withLineItems);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; fringeId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const fringe = await loadFringe(params.id, params.fringeId);
  if (!fringe) return NextResponse.json({ error: "Fringe não encontrado." }, { status: 404 });

  await prisma.fringe.delete({ where: { id: fringe.id } });

  return NextResponse.json({ ok: true });
}
