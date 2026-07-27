import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { recalculateDaySchedule } from "@/lib/shots";
import { shotScheduleUpdateSchema } from "@/lib/validation/shot-schedule";

const shotInclude = {
  shot: {
    include: {
      scene: { select: { id: true, numero: true } },
    },
  },
} as const;

async function findSchedule(projectId: string, shootDayId: string, scheduleId: string) {
  return prisma.shotSchedule.findFirst({
    where: { id: scheduleId, shootDayId, projectId },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; shootDayId: string; scheduleId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const schedule = await findSchedule(params.id, params.shootDayId, params.scheduleId);
  if (!schedule) return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = shotScheduleUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.shotSchedule.update({
    where: { id: schedule.id },
    data: parsed.data,
    include: shotInclude,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; shootDayId: string; scheduleId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const schedule = await findSchedule(params.id, params.shootDayId, params.scheduleId);
  if (!schedule) return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });

  await prisma.shotSchedule.delete({ where: { id: schedule.id } });

  await recalculateDaySchedule(params.shootDayId);

  return NextResponse.json({ ok: true });
}
