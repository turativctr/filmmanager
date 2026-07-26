import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { recalculateDaySchedule } from "@/lib/shots";
import { shotScheduleReorderSchema } from "@/lib/validation/shot-schedule";

const shotInclude = {
  shot: {
    include: {
      scene: { select: { id: true, numero: true } },
    },
  },
} as const;

export async function POST(request: Request, { params }: { params: { id: string; shootDayId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const shootDay = await prisma.shootDay.findFirst({ where: { id: params.shootDayId, projectId: params.id } });
  if (!shootDay) return NextResponse.json({ error: "Diária não encontrada." }, { status: 404 });

  const body = await request.json();
  const parsed = shotScheduleReorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { order } = parsed.data;
  const existing = await prisma.shotSchedule.findMany({ where: { shootDayId: shootDay.id }, select: { id: true } });
  const existingIds = new Set(existing.map((s) => s.id));

  if (order.length !== existingIds.size || !order.every((id) => existingIds.has(id))) {
    return NextResponse.json({ error: "Lista de planos não corresponde ao agendamento desta diária." }, { status: 400 });
  }

  // Duas fases (offset negativo, depois posição final) — evita colisão com a constraint única
  // (shootDayId, ordem) ao trocar planos de posição, sem apagar e recriar linhas.
  await prisma.$transaction([
    ...order.map((id, index) => prisma.shotSchedule.update({ where: { id }, data: { ordem: -(index + 1) } })),
    ...order.map((id, index) => prisma.shotSchedule.update({ where: { id }, data: { ordem: index + 1 } })),
  ]);

  await recalculateDaySchedule(shootDay.id);

  const schedules = await prisma.shotSchedule.findMany({
    where: { shootDayId: shootDay.id },
    orderBy: { ordem: "asc" },
    include: shotInclude,
  });

  return NextResponse.json(schedules);
}
