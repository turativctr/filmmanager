import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getLocacoesListData } from "@/lib/locacao-data";
import { findAddressDuplicates } from "@/lib/locacao-server";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { locacaoSchema } from "@/lib/validation/locacao";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const data = await getLocacoesListData(params.id);

  return NextResponse.json(data);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = locacaoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const locacao = await prisma.locacao.create({ data: { ...parsed.data, projectId: params.id } });

  const possibleDuplicates = parsed.data.endereco
    ? await findAddressDuplicates(params.id, parsed.data.endereco, locacao.id)
    : [];

  return NextResponse.json({ locacao, possibleDuplicates }, { status: 201 });
}
