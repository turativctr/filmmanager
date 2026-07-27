import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { findOwnedProject } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { actualSchema } from "@/lib/validation/budget";

async function loadActual(projectId: string, actualId: string) {
  return prisma.actual.findFirst({
    where: { id: actualId, budget: { projectId } },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; actualId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const actual = await loadActual(params.id, params.actualId);
  if (!actual) return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = actualSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (parsed.data.accountId) {
    const account = await prisma.budgetAccount.findFirst({
      where: { id: parsed.data.accountId, budgetId: actual.budgetId },
    });
    if (!account) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
  }

  const updated = await prisma.actual.update({
    where: { id: actual.id },
    data: {
      accountId: parsed.data.accountId,
      descricao: parsed.data.descricao,
      valor: parsed.data.valor,
      data: parsed.data.data ? new Date(parsed.data.data) : undefined,
      notas: parsed.data.notas !== undefined ? parsed.data.notas || null : undefined,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; actualId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const actual = await loadActual(params.id, params.actualId);
  if (!actual) return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });

  await prisma.actual.delete({ where: { id: actual.id } });

  return NextResponse.json({ ok: true });
}
