import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { calendarEventSchema } from "@/lib/validation/calendar-event";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; eventId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const event = await prisma.calendarEvent.findFirst({
    where: { id: params.eventId, projectId: params.id },
  });
  if (!event) return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = calendarEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, ...rest } = parsed.data;

  const updated = await prisma.calendarEvent.update({
    where: { id: event.id },
    data: { ...rest, data: new Date(data) },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; eventId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const event = await prisma.calendarEvent.findFirst({
    where: { id: params.eventId, projectId: params.id },
  });
  if (!event) return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });

  await prisma.calendarEvent.delete({ where: { id: event.id } });

  return NextResponse.json({ ok: true });
}
