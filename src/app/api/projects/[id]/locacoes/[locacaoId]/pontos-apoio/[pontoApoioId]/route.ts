import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { pontoApoioSchema } from "@/lib/validation/locacao";

async function loadPontoApoio(projectId: string, locacaoId: string, pontoApoioId: string) {
  return prisma.pontoApoio.findFirst({
    where: { id: pontoApoioId, locacaoId, locacao: { projectId } },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; locacaoId: string; pontoApoioId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const existing = await loadPontoApoio(params.id, params.locacaoId, params.pontoApoioId);
  if (!existing) return NextResponse.json({ error: "Ponto de apoio não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = pontoApoioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const pontoApoio = await prisma.pontoApoio.update({ where: { id: existing.id }, data: parsed.data });

  return NextResponse.json(pontoApoio);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; locacaoId: string; pontoApoioId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const existing = await loadPontoApoio(params.id, params.locacaoId, params.pontoApoioId);
  if (!existing) return NextResponse.json({ error: "Ponto de apoio não encontrado." }, { status: 404 });

  await prisma.pontoApoio.delete({ where: { id: existing.id } });

  return NextResponse.json({ ok: true });
}
