import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { pontosApoioReorderSchema } from "@/lib/validation/locacao";

export async function PATCH(
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
  const parsed = pontosApoioReorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const pontos = await prisma.pontoApoio.findMany({
    where: { locacaoId: locacao.id, id: { in: parsed.data.pontoApoioIds } },
    select: { id: true },
  });
  if (pontos.length !== parsed.data.pontoApoioIds.length) {
    return NextResponse.json({ error: "Lista de pontos de apoio inválida." }, { status: 400 });
  }

  await prisma.$transaction(
    parsed.data.pontoApoioIds.map((pontoApoioId, index) =>
      prisma.pontoApoio.update({ where: { id: pontoApoioId }, data: { ordem: index } })
    )
  );

  return NextResponse.json({ ok: true });
}
