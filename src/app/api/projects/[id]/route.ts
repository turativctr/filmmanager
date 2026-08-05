import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { recalculateAllDayBlocksForProject } from "@/lib/shootday-blocks";
import { recalculateAllResetsForProject } from "@/lib/shots";
import { projectUpdateSchema } from "@/lib/validation/project";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);

  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  return NextResponse.json(project);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = projectUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { dataInicio, dataFim, ...rest } = parsed.data;

  const updated = await prisma.project.update({
    where: { id: project.id },
    data: {
      ...rest,
      dataInicio: dataInicio ? new Date(dataInicio) : dataInicio === null ? null : undefined,
      dataFim: dataFim ? new Date(dataFim) : dataFim === null ? null : undefined,
    },
  });

  // A Jornada (limiteAlmocoMin/duracaoAlmocoMin/preparacaoInicialMin) afeta o cálculo de bloco/almoço
  // de TODAS as diárias do projeto, não só a que estava sendo editada — recalcula todas quando muda.
  if (
    rest.limiteAlmocoMin !== undefined ||
    rest.duracaoAlmocoMin !== undefined ||
    rest.preparacaoInicialMin !== undefined
  ) {
    await recalculateAllDayBlocksForProject(project.id);
  }

  // Tempos de reset (nível 1) mudaram — recalcula tipoReset/tempoResetMin de TODO plano do
  // projeto, pra "calibrar uma vez" refletir imediatamente sem precisar tocar em cada plano.
  if (
    rest.resetAjusteMin !== undefined ||
    rest.resetTrocaLenteMin !== undefined ||
    rest.resetTrocaCameraMin !== undefined ||
    rest.resetPosicaoMin !== undefined ||
    rest.resetCompletoMin !== undefined
  ) {
    await recalculateAllResetsForProject(project.id);
  }

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  await prisma.project.delete({ where: { id: project.id } });

  return NextResponse.json({ ok: true });
}
