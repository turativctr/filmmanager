import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { horaAHoraEventSchema } from "@/lib/validation/hora-a-hora";

export async function POST(request: Request, { params }: { params: { id: string; shootDayId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const shootDay = await prisma.shootDay.findFirst({ where: { id: params.shootDayId, projectId: params.id } });
  if (!shootDay) return NextResponse.json({ error: "Diária não encontrada." }, { status: 404 });

  const body = await request.json();
  const parsed = horaAHoraEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const maxOrdem = await prisma.horaAHoraEvent.aggregate({
    where: { shootDayId: shootDay.id },
    _max: { ordem: true },
  });

  const created = await prisma.horaAHoraEvent.create({
    data: {
      shootDayId: shootDay.id,
      horaInicio: parsed.data.horaInicio,
      horaFim: parsed.data.horaFim ?? null,
      descricao: parsed.data.descricao,
      tipo: parsed.data.tipo,
      geradoAutomaticamente: false,
      ordem: (maxOrdem._max.ordem ?? -1) + 1,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
