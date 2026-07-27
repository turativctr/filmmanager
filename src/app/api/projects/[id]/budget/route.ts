import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { populateBudgetTemplate } from "@/lib/budget-templates";
import { syncSchedulingGlobals } from "@/lib/budget-server";
import { findOwnedProject } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { budgetSettingsSchema } from "@/lib/validation/budget";

const BUDGET_INCLUDE = {
  accountGroups: {
    orderBy: { ordem: "asc" as const },
    include: {
      accounts: {
        orderBy: { ordem: "asc" as const },
        include: {
          lineItems: { orderBy: { ordem: "asc" as const } },
        },
      },
    },
  },
  globals: { orderBy: { chave: "asc" as const } },
  fringes: { orderBy: { nome: "asc" as const }, include: { fringeLineItems: true } },
};

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const budget = await prisma.budget.findUnique({
    where: { projectId: params.id },
    include: BUDGET_INCLUDE,
  });

  if (!budget) return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });

  return NextResponse.json(budget);
}

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const existing = await prisma.budget.findUnique({ where: { projectId: params.id } });
  if (existing) return NextResponse.json({ error: "Este projeto já tem um orçamento." }, { status: 409 });

  const budget = await prisma.$transaction(async (tx) => {
    const created = await tx.budget.create({ data: { projectId: params.id } });
    await populateBudgetTemplate(tx, created.id);
    await syncSchedulingGlobals(tx, params.id, created.id);
    return created;
  });

  const full = await prisma.budget.findUnique({ where: { id: budget.id }, include: BUDGET_INCLUDE });

  return NextResponse.json(full, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const budget = await prisma.budget.findUnique({ where: { projectId: params.id } });
  if (!budget) return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = budgetSettingsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.budget.update({ where: { id: budget.id }, data: parsed.data });

  return NextResponse.json(updated);
}
