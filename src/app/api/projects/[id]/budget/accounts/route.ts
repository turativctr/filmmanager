import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { findOwnedProject } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { budgetAccountSchema } from "@/lib/validation/budget";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const budget = await prisma.budget.findUnique({ where: { projectId: params.id } });
  if (!budget) return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = budgetAccountSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const group = await prisma.accountGroup.findFirst({ where: { id: parsed.data.groupId, budgetId: budget.id } });
  if (!group) return NextResponse.json({ error: "Grupo não encontrado." }, { status: 404 });

  const duplicate = await prisma.budgetAccount.findFirst({
    where: { budgetId: budget.id, codigo: parsed.data.codigo },
  });
  if (duplicate) return NextResponse.json({ error: "Já existe uma conta com esse código." }, { status: 409 });

  const maxOrdem = await prisma.budgetAccount.aggregate({
    where: { groupId: group.id },
    _max: { ordem: true },
  });

  const account = await prisma.budgetAccount.create({
    data: {
      budgetId: budget.id,
      groupId: group.id,
      codigo: parsed.data.codigo,
      nome: parsed.data.nome,
      ordem: parsed.data.ordem ?? (maxOrdem._max.ordem ?? -1) + 1,
    },
  });

  return NextResponse.json(account, { status: 201 });
}
