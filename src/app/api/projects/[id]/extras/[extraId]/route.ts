import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { parseTimeInput } from "@/lib/time";
import { extraSchema } from "@/lib/validation/extra";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; extraId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const extra = await prisma.extra.findFirst({ where: { id: params.extraId, projectId: params.id } });
  if (!extra) return NextResponse.json({ error: "Figuração não encontrada." }, { status: 404 });

  const body = await request.json();
  const parsed = extraSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { cenaIds, chamada, saida, ...data } = parsed.data;

  const updated = await prisma.extra.update({
    where: { id: extra.id },
    data: {
      ...data,
      chamada: parseTimeInput(chamada),
      saida: parseTimeInput(saida),
      ...(cenaIds
        ? { cenas: { deleteMany: {}, create: cenaIds.map((sceneId) => ({ sceneId })) } }
        : {}),
    },
    include: { cenas: { include: { scene: { select: { numero: true } } } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; extraId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const extra = await prisma.extra.findFirst({ where: { id: params.extraId, projectId: params.id } });
  if (!extra) return NextResponse.json({ error: "Figuração não encontrada." }, { status: 404 });

  await prisma.extra.delete({ where: { id: extra.id } });

  return NextResponse.json({ ok: true });
}
