import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { parseTimeInput } from "@/lib/time";
import { extraSchema } from "@/lib/validation/extra";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const extras = await prisma.extra.findMany({
    where: { projectId: params.id },
    include: { cenas: { include: { scene: { select: { numero: true } } } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(extras);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = extraSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { cenaIds, chamada, saida, ...data } = parsed.data;

  const extra = await prisma.extra.create({
    data: {
      ...data,
      chamada: parseTimeInput(chamada),
      saida: parseTimeInput(saida),
      projectId: params.id,
      cenas: cenaIds?.length ? { create: cenaIds.map((sceneId) => ({ sceneId })) } : undefined,
    },
    include: { cenas: { include: { scene: { select: { numero: true } } } } },
  });

  return NextResponse.json(extra, { status: 201 });
}
