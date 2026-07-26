import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { recalculateDaySchedule } from "@/lib/shots";
import { shotScheduleAssignSchema } from "@/lib/validation/shot-schedule";

const shotInclude = {
  shot: {
    include: {
      scene: { select: { id: true, numero: true } },
    },
  },
} as const;

export async function GET(_request: Request, { params }: { params: { id: string; shootDayId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const shootDay = await prisma.shootDay.findFirst({ where: { id: params.shootDayId, projectId: params.id } });
  if (!shootDay) return NextResponse.json({ error: "Diária não encontrada." }, { status: 404 });

  const schedules = await prisma.shotSchedule.findMany({
    where: { shootDayId: shootDay.id },
    orderBy: { ordem: "asc" },
    include: shotInclude,
  });

  return NextResponse.json(schedules);
}

export async function POST(request: Request, { params }: { params: { id: string; shootDayId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const shootDay = await prisma.shootDay.findFirst({ where: { id: params.shootDayId, projectId: params.id } });
  if (!shootDay) return NextResponse.json({ error: "Diária não encontrada." }, { status: 404 });

  const body = await request.json();
  const parsed = shotScheduleAssignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const shot = await prisma.shot.findFirst({ where: { id: parsed.data.shotId, projectId: params.id } });
  if (!shot) return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });

  const existing = await prisma.shotSchedule.findUnique({ where: { shotId: shot.id } });
  if (existing) {
    return NextResponse.json({ error: "Este plano já está agendado num dia." }, { status: 400 });
  }

  const maxOrdem = await prisma.shotSchedule.aggregate({
    where: { shootDayId: shootDay.id },
    _max: { ordem: true },
  });

  await prisma.shotSchedule.create({
    data: {
      shotId: shot.id,
      shootDayId: shootDay.id,
      projectId: params.id,
      bloco: parsed.data.bloco ?? undefined,
      ordem: (maxOrdem._max.ordem ?? 0) + 1,
    },
  });

  await recalculateDaySchedule(shootDay.id);

  const schedules = await prisma.shotSchedule.findMany({
    where: { shootDayId: shootDay.id },
    orderBy: { ordem: "asc" },
    include: shotInclude,
  });

  return NextResponse.json(schedules, { status: 201 });
}
