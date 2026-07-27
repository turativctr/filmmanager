import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getLocacaoDetailData } from "@/lib/locacao-data";
import { findAddressDuplicates } from "@/lib/locacao-server";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { locacaoSchema } from "@/lib/validation/locacao";

async function loadLocacao(projectId: string, locacaoId: string) {
  return prisma.locacao.findFirst({ where: { id: locacaoId, projectId } });
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string; locacaoId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const data = await getLocacaoDetailData(params.id, params.locacaoId);
  if (!data) return NextResponse.json({ error: "Locação não encontrada." }, { status: 404 });

  return NextResponse.json(data);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; locacaoId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const existing = await loadLocacao(params.id, params.locacaoId);
  if (!existing) return NextResponse.json({ error: "Locação não encontrada." }, { status: 404 });

  const body = await request.json();
  const parsed = locacaoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const locacao = await prisma.locacao.update({ where: { id: existing.id }, data: parsed.data });

  const possibleDuplicates = parsed.data.endereco
    ? await findAddressDuplicates(params.id, parsed.data.endereco, locacao.id)
    : [];

  return NextResponse.json({ locacao, possibleDuplicates });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; locacaoId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const existing = await loadLocacao(params.id, params.locacaoId);
  if (!existing) return NextResponse.json({ error: "Locação não encontrada." }, { status: 404 });

  const scenesCount = await prisma.scene.count({ where: { locacaoId: existing.id } });
  if (scenesCount > 0) {
    return NextResponse.json(
      { error: "Esta locação tem cenas vinculadas. Mova as cenas ou unifique com outra locação antes de excluir." },
      { status: 409 }
    );
  }

  await prisma.locacao.delete({ where: { id: existing.id } });

  return NextResponse.json({ ok: true });
}
