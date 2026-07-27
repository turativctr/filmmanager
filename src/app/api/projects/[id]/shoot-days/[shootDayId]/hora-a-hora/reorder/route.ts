import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { horaAHoraReorderSchema } from "@/lib/validation/hora-a-hora";

export async function PATCH(request: Request, { params }: { params: { id: string; shootDayId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = horaAHoraReorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const events = await prisma.horaAHoraEvent.findMany({
    where: { shootDayId: params.shootDayId, id: { in: parsed.data.eventIds } },
    select: { id: true },
  });
  if (events.length !== parsed.data.eventIds.length) {
    return NextResponse.json({ error: "Lista de eventos inválida." }, { status: 400 });
  }

  await prisma.$transaction(
    parsed.data.eventIds.map((eventId, index) =>
      prisma.horaAHoraEvent.update({ where: { id: eventId }, data: { ordem: index } })
    )
  );

  return NextResponse.json({ ok: true });
}
