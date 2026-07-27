import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { saveLineItemWithCalc } from "@/lib/budget-server";
import { findOwnedProject } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { lineItemSchema } from "@/lib/validation/budget";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const budget = await prisma.budget.findUnique({ where: { projectId: params.id } });
  if (!budget) return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = lineItemSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const account = await prisma.budgetAccount.findFirst({
    where: { id: parsed.data.accountId, budgetId: budget.id },
  });
  if (!account) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });

  const maxOrdem = await prisma.lineItem.aggregate({
    where: { accountId: account.id },
    _max: { ordem: true },
  });

  const lineItem = await prisma.$transaction((tx) =>
    saveLineItemWithCalc(tx, budget.id, null, {
      ...parsed.data,
      globalRef: parsed.data.globalRef || null,
      notas: parsed.data.notas || null,
      ordem: parsed.data.ordem ?? (maxOrdem._max.ordem ?? -1) + 1,
    })
  );

  return NextResponse.json(lineItem, { status: 201 });
}
