import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { findOwnedProject } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { accountGroupSchema } from "@/lib/validation/budget";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const budget = await prisma.budget.findUnique({ where: { projectId: params.id } });
  if (!budget) return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = accountGroupSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const duplicate = await prisma.accountGroup.findFirst({
    where: { budgetId: budget.id, codigo: parsed.data.codigo },
  });
  if (duplicate) return NextResponse.json({ error: "Já existe um grupo com esse código." }, { status: 409 });

  const maxOrdem = await prisma.accountGroup.aggregate({
    where: { budgetId: budget.id },
    _max: { ordem: true },
  });

  const group = await prisma.accountGroup.create({
    data: {
      budgetId: budget.id,
      codigo: parsed.data.codigo,
      nome: parsed.data.nome,
      tipo: parsed.data.tipo,
      ordem: parsed.data.ordem ?? (maxOrdem._max.ordem ?? -1) + 1,
    },
  });

  return NextResponse.json(group, { status: 201 });
}
