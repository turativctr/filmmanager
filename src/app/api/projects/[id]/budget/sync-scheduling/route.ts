import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { syncSchedulingGlobals } from "@/lib/budget-server";
import { findOwnedProject } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const budget = await prisma.budget.findUnique({ where: { projectId: params.id } });
  if (!budget) return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });

  const result = await prisma.$transaction((tx) => syncSchedulingGlobals(tx, params.id, budget.id));

  return NextResponse.json(result);
}
