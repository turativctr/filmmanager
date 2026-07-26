import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { recalcAllFringesForBudget } from "@/lib/budget-server";
import { findOwnedProject } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { budgetAccountSchema } from "@/lib/validation/budget";

async function loadAccount(projectId: string, accountId: string) {
  return prisma.budgetAccount.findFirst({
    where: { id: accountId, budget: { projectId } },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; accountId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const account = await loadAccount(params.id, params.accountId);
  if (!account) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });

  const body = await request.json();
  const parsed = budgetAccountSchema.omit({ groupId: true }).partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.budgetAccount.update({ where: { id: account.id }, data: parsed.data });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; accountId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const account = await loadAccount(params.id, params.accountId);
  if (!account) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.budgetAccount.delete({ where: { id: account.id } });
    await recalcAllFringesForBudget(tx, account.budgetId);
  });

  return NextResponse.json({ ok: true });
}
