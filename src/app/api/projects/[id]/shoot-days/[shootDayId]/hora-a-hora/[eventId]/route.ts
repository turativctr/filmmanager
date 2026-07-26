import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { horaAHoraEventUpdateSchema } from "@/lib/validation/hora-a-hora";

async function findEvent(projectId: string, shootDayId: string, eventId: string) {
  return prisma.horaAHoraEvent.findFirst({
    where: { id: eventId, shootDayId, shootDay: { projectId } },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; shootDayId: string; eventId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const event = await findEvent(params.id, params.shootDayId, params.eventId);
  if (!event) return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = horaAHoraEventUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.horaAHoraEvent.update({
    where: { id: event.id },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; shootDayId: string; eventId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const event = await findEvent(params.id, params.shootDayId, params.eventId);
  if (!event) return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });

  await prisma.horaAHoraEvent.delete({ where: { id: event.id } });

  return NextResponse.json({ ok: true });
}
