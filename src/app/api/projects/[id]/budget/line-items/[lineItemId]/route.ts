import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { deleteLineItemWithCalc, saveLineItemWithCalc } from "@/lib/budget-server";
import { findOwnedProject } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { lineItemSchema } from "@/lib/validation/budget";

async function loadLineItem(projectId: string, lineItemId: string) {
  return prisma.lineItem.findFirst({
    where: { id: lineItemId, budget: { projectId } },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; lineItemId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const lineItem = await loadLineItem(params.id, params.lineItemId);
  if (!lineItem) return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = lineItemSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const merged = {
    accountId: parsed.data.accountId ?? lineItem.accountId,
    descricao: parsed.data.descricao ?? lineItem.descricao,
    quantidade: parsed.data.quantidade ?? Number(lineItem.quantidade),
    unidade: parsed.data.unidade ?? lineItem.unidade,
    periodo: parsed.data.periodo ?? Number(lineItem.periodo),
    taxa: parsed.data.taxa ?? Number(lineItem.taxa),
    moeda: parsed.data.moeda ?? lineItem.moeda,
    taxaCambio: parsed.data.taxaCambio ?? Number(lineItem.taxaCambio),
    isFrengeable: parsed.data.isFrengeable ?? lineItem.isFrengeable,
    globalRef: parsed.data.globalRef !== undefined ? parsed.data.globalRef || null : lineItem.globalRef,
    notas: parsed.data.notas !== undefined ? parsed.data.notas || null : lineItem.notas,
    ordem: parsed.data.ordem ?? lineItem.ordem,
  };

  const updated = await prisma.$transaction((tx) =>
    saveLineItemWithCalc(tx, lineItem.budgetId, lineItem.id, merged)
  );

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; lineItemId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const lineItem = await loadLineItem(params.id, params.lineItemId);
  if (!lineItem) return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });

  await prisma.$transaction((tx) => deleteLineItemWithCalc(tx, lineItem.budgetId, lineItem.id));

  return NextResponse.json({ ok: true });
}
