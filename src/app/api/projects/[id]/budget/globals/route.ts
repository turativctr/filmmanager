import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { recalcLineItemsForGlobal } from "@/lib/budget-server";
import { findOwnedProject } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { globalSchema } from "@/lib/validation/budget";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const budget = await prisma.budget.findUnique({ where: { projectId: params.id } });
  if (!budget) return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = globalSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const duplicate = await prisma.global.findFirst({ where: { budgetId: budget.id, chave: parsed.data.chave } });
  if (duplicate) return NextResponse.json({ error: "Já existe um global com essa chave." }, { status: 409 });

  const global = await prisma.$transaction(async (tx) => {
    // Auto-vincula LineItems órfãos que já referenciam essa chave (caso tenham sido criados antes do Global existir).
    const orphans = await tx.lineItem.findMany({
      where: { budgetId: budget.id, globalRef: parsed.data.chave },
      select: { id: true },
    });

    const created = await tx.global.create({
      data: { ...parsed.data, budgetId: budget.id, afetaLinhas: orphans.map((o) => o.id) },
    });

    if (orphans.length > 0) {
      await recalcLineItemsForGlobal(tx, budget.id, created);
    }

    return created;
  });

  return NextResponse.json(global, { status: 201 });
}
