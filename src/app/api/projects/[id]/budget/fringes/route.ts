import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { recalcFringeLineItems } from "@/lib/budget-server";
import { findOwnedProject } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { fringeSchema } from "@/lib/validation/budget";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const budget = await prisma.budget.findUnique({ where: { projectId: params.id } });
  if (!budget) return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = fringeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const fringe = await prisma.$transaction(async (tx) => {
    const created = await tx.fringe.create({ data: { ...parsed.data, budgetId: budget.id } });
    await recalcFringeLineItems(tx, budget.id, created);
    return created;
  });

  const withLineItems = await prisma.fringe.findUnique({
    where: { id: fringe.id },
    include: { fringeLineItems: true },
  });

  return NextResponse.json(withLineItems, { status: 201 });
}
