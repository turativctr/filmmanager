import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { sceneShootDayObservacoesSchema } from "@/lib/validation/scene-progress";

// Edição manual pelo AD — sempre zera observacoesAutoGeradas (faz o badge "Gerado automaticamente"
// sumir), mesmo que o texto resultante coincida por acaso com o texto pré-preenchido original.
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
  const parsed = sceneShootDayObservacoesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.sceneShootDay.update({
    where: { id: entry.id },
    data: { observacoes: parsed.data.observacoes, observacoesAutoGeradas: false },
  });

  return NextResponse.json(updated);
}
