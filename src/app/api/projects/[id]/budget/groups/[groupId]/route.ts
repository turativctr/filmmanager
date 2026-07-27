import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { findOwnedProject } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { accountGroupSchema } from "@/lib/validation/budget";

async function loadGroup(projectId: string, groupId: string) {
  return prisma.accountGroup.findFirst({
    where: { id: groupId, budget: { projectId } },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; groupId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const group = await loadGroup(params.id, params.groupId);
  if (!group) return NextResponse.json({ error: "Grupo não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = accountGroupSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.accountGroup.update({ where: { id: group.id }, data: parsed.data });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; groupId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const group = await loadGroup(params.id, params.groupId);
  if (!group) return NextResponse.json({ error: "Grupo não encontrado." }, { status: 404 });

  await prisma.accountGroup.delete({ where: { id: group.id } });

  return NextResponse.json({ ok: true });
}
