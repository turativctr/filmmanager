import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { isProjectStepEtapa } from "@/lib/project-step";

export async function POST(_request: Request, { params }: { params: { id: string; etapa: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  if (!isProjectStepEtapa(params.etapa)) {
    return NextResponse.json({ error: "Etapa inválida." }, { status: 400 });
  }

  const override = await prisma.projectStepOverride.upsert({
    where: { projectId_etapa: { projectId: project.id, etapa: params.etapa } },
    create: { projectId: project.id, etapa: params.etapa, concluidaManualmente: true, concluidaEm: new Date() },
    update: { concluidaManualmente: true, concluidaEm: new Date() },
  });

  return NextResponse.json(override);
}

export async function DELETE(_request: Request, { params }: { params: { id: string; etapa: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  if (!isProjectStepEtapa(params.etapa)) {
    return NextResponse.json({ error: "Etapa inválida." }, { status: 400 });
  }

  await prisma.projectStepOverride.deleteMany({ where: { projectId: project.id, etapa: params.etapa } });

  return NextResponse.json({ ok: true });
}
