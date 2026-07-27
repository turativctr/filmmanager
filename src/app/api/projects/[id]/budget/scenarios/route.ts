import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { findOwnedProject } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { scenarioSchema } from "@/lib/validation/budget";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const budget = await prisma.budget.findUnique({ where: { projectId: params.id } });
  if (!budget) return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = scenarioSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const scenario = await prisma.$transaction(async (tx) => {
    if (parsed.data.isBase) {
      await tx.budgetScenario.updateMany({ where: { budgetId: budget.id }, data: { isBase: false } });
    }

    return tx.budgetScenario.create({
      data: {
        budgetId: budget.id,
        nome: parsed.data.nome,
        notas: parsed.data.notas || null,
        isBase: parsed.data.isBase ?? false,
        overrides: {
          create: parsed.data.overrides.map((o) => ({ chave: o.chave, valor: o.valor })),
        },
      },
      include: { overrides: true },
    });
  });

  return NextResponse.json(scenario, { status: 201 });
}
