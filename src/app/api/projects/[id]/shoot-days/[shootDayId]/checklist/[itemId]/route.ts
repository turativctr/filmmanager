import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { checklistUpdateSchema } from "@/lib/validation/ordem-do-dia";

async function findItem(projectId: string, shootDayId: string, itemId: string) {
  return prisma.shootDayChecklist.findFirst({
    where: { id: itemId, shootDayId, shootDay: { projectId } },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; shootDayId: string; itemId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const item = await findItem(params.id, params.shootDayId, params.itemId);
  if (!item) return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = checklistUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.shootDayChecklist.update({
    where: { id: item.id },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; shootDayId: string; itemId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const item = await findItem(params.id, params.shootDayId, params.itemId);
  if (!item) return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });

  await prisma.shootDayChecklist.delete({ where: { id: item.id } });

  return NextResponse.json({ ok: true });
}
