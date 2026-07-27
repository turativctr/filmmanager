import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { pontoApoioSchema } from "@/lib/validation/locacao";

export async function POST(
  request: Request,
  { params }: { params: { id: string; locacaoId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const locacao = await prisma.locacao.findFirst({ where: { id: params.locacaoId, projectId: params.id } });
  if (!locacao) return NextResponse.json({ error: "Locação não encontrada." }, { status: 404 });

  const body = await request.json();
  const parsed = pontoApoioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const count = await prisma.pontoApoio.count({ where: { locacaoId: locacao.id } });

  const pontoApoio = await prisma.pontoApoio.create({
    data: { ...parsed.data, locacaoId: locacao.id, ordem: count },
  });

  return NextResponse.json(pontoApoio, { status: 201 });
}
