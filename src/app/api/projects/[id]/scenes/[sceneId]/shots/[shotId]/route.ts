import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { recalculateScene } from "@/lib/shots";
import { computeTempoTotal } from "@/lib/shots-shared";
import { shotSchema } from "@/lib/validation/shot";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; sceneId: string; shotId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const shot = await prisma.shot.findFirst({
    where: { id: params.shotId, sceneId: params.sceneId, scene: { projectId: params.id } },
  });
  if (!shot) return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = shotSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const takesPrevistos = parsed.data.takesPrevistos ?? shot.takesPrevistos;
  const duracaoTakeMin = parsed.data.duracaoTakeMin ?? shot.duracaoTakeMin;
  const tempoSetupMin = parsed.data.tempoSetupMin ?? shot.tempoSetupMin;

  await prisma.shot.update({
    where: { id: shot.id },
    data: {
      ...parsed.data,
      tempoTotalMin: computeTempoTotal(takesPrevistos, duracaoTakeMin, tempoSetupMin),
    },
  });

  const shots = await recalculateScene(shot.sceneId);

  return NextResponse.json(shots);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; sceneId: string; shotId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const shot = await prisma.shot.findFirst({
    where: { id: params.shotId, sceneId: params.sceneId, scene: { projectId: params.id } },
  });
  if (!shot) return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });

  await prisma.shot.delete({ where: { id: shot.id } });

  const shots = await recalculateScene(shot.sceneId);

  return NextResponse.json(shots);
}
