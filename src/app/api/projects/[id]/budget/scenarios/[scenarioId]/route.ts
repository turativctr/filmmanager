import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { findOwnedProject } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { scenarioSchema } from "@/lib/validation/budget";

async function loadScenario(projectId: string, scenarioId: string) {
  return prisma.budgetScenario.findFirst({
    where: { id: scenarioId, budget: { projectId } },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; scenarioId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const scenario = await loadScenario(params.id, params.scenarioId);
  if (!scenario) return NextResponse.json({ error: "Cenário não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = scenarioSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.$transaction(async (tx) => {
    if (parsed.data.isBase) {
      await tx.budgetScenario.updateMany({
        where: { budgetId: scenario.budgetId, NOT: { id: scenario.id } },
        data: { isBase: false },
      });
    }

    if (parsed.data.overrides) {
      await tx.scenarioGlobalOverride.deleteMany({ where: { scenarioId: scenario.id } });
    }

    return tx.budgetScenario.update({
      where: { id: scenario.id },
      data: {
        nome: parsed.data.nome,
        notas: parsed.data.notas !== undefined ? parsed.data.notas || null : undefined,
        isBase: parsed.data.isBase,
        overrides: parsed.data.overrides
          ? { create: parsed.data.overrides.map((o) => ({ chave: o.chave, valor: o.valor })) }
          : undefined,
      },
      include: { overrides: true },
    });
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; scenarioId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const scenario = await loadScenario(params.id, params.scenarioId);
  if (!scenario) return NextResponse.json({ error: "Cenário não encontrado." }, { status: 404 });

  if (scenario.isBase) {
    return NextResponse.json(
      { error: "Não é possível excluir o cenário base. Marque outro cenário como base primeiro." },
      { status: 400 }
    );
  }

  await prisma.budgetScenario.delete({ where: { id: scenario.id } });

  return NextResponse.json({ ok: true });
}
