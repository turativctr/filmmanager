import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { sceneShootDayStatusSchema } from "@/lib/validation/scene-progress";

function nowHHmm(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function timestampsFor(
  target: "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA" | "ADIADA",
  current: { horaInicioReal: string | null; horaFimReal: string | null }
): { horaInicioReal: string | null; horaFimReal: string | null } {
  const now = nowHHmm();
  switch (target) {
    case "PENDENTE":
      return { horaInicioReal: null, horaFimReal: null };
    case "EM_ANDAMENTO":
      return { horaInicioReal: current.horaInicioReal ?? now, horaFimReal: null };
    case "CONCLUIDA":
      return { horaInicioReal: current.horaInicioReal ?? now, horaFimReal: current.horaFimReal ?? now };
    case "ADIADA":
      return { horaInicioReal: current.horaInicioReal, horaFimReal: current.horaFimReal };
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; shootDayId: string; sceneId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const entry = await prisma.sceneShootDay.findFirst({
    where: { shootDayId: params.shootDayId, sceneId: params.sceneId, shootDay: { projectId: params.id } },
  });
  if (!entry) return NextResponse.json({ error: "Cena não encontrada nesta diária." }, { status: 404 });

  const body = await request.json();
  const parsed = sceneShootDayStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const timestamps = timestampsFor(parsed.data.status, entry);

  const updated = await prisma.sceneShootDay.update({
    where: { id: entry.id },
    data: { status: parsed.data.status, ...timestamps },
  });

  return NextResponse.json(updated);
}
