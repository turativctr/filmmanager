import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { taskUpdateSchema } from "@/lib/validation/task";

async function findTask(projectId: string, taskId: string) {
  return prisma.task.findFirst({ where: { id: taskId, projectId } });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; taskId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const task = await findTask(params.id, params.taskId);
  if (!task) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });

  const body = await request.json();
  const parsed = taskUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { concluida, ...rest } = parsed.data;

  // concluidaEm é sempre derivado no servidor — nunca aceito do client — pra não permitir gravar
  // uma data de conclusão arbitrária, e pra sempre limpar quando a tarefa volta a ficar pendente.
  const data: typeof rest & { concluida?: boolean; concluidaEm?: Date | null } = { ...rest };
  if (concluida !== undefined) {
    data.concluida = concluida;
    data.concluidaEm = concluida ? new Date() : null;
  }

  const updated = await prisma.task.update({ where: { id: task.id }, data });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; taskId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const task = await findTask(params.id, params.taskId);
  if (!task) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });

  await prisma.task.delete({ where: { id: task.id } });

  return NextResponse.json({ ok: true });
}
