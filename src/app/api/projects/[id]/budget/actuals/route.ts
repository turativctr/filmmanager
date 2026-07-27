import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { findOwnedProject } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { actualSchema } from "@/lib/validation/budget";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const budget = await prisma.budget.findUnique({ where: { projectId: params.id } });
  if (!budget) return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = actualSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const account = await prisma.budgetAccount.findFirst({
    where: { id: parsed.data.accountId, budgetId: budget.id },
  });
  if (!account) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });

  const actual = await prisma.actual.create({
    data: {
      budgetId: budget.id,
      accountId: account.id,
      descricao: parsed.data.descricao,
      valor: parsed.data.valor,
      data: new Date(parsed.data.data),
      notas: parsed.data.notas || null,
    },
  });

  return NextResponse.json(actual, { status: 201 });
}
