import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { recalculateScene } from "@/lib/shots";
import { computeTempoTotal } from "@/lib/shots-shared";
import { shotSchema } from "@/lib/validation/shot";

// Espelha os @default do model Shot — usados pra resolver o valor efetivo de campos omitidos
// antes de calcular tempoTotalMin (Postgres não permite default computado a partir de outra coluna).
const SHOT_DEFAULTS = { takesPrevistos: 3, duracaoTakeMin: 2, tempoSetupMin: 0 };

export async function GET(_request: Request, { params }: { params: { id: string; sceneId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const scene = await prisma.scene.findFirst({ where: { id: params.sceneId, projectId: params.id } });
  if (!scene) return NextResponse.json({ error: "Cena não encontrada." }, { status: 404 });

  const shots = await prisma.shot.findMany({ where: { sceneId: scene.id }, orderBy: { ordem: "asc" } });

  return NextResponse.json(shots);
}

export async function POST(request: Request, { params }: { params: { id: string; sceneId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const scene = await prisma.scene.findFirst({ where: { id: params.sceneId, projectId: params.id } });
  if (!scene) return NextResponse.json({ error: "Cena não encontrada." }, { status: 404 });

  const body = await request.json();
  const parsed = shotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const last = await prisma.shot.findFirst({ where: { sceneId: scene.id }, orderBy: { ordem: "desc" } });

  const takesPrevistos = parsed.data.takesPrevistos ?? SHOT_DEFAULTS.takesPrevistos;
  const duracaoTakeMin = parsed.data.duracaoTakeMin ?? SHOT_DEFAULTS.duracaoTakeMin;
  const tempoSetupMin = parsed.data.tempoSetupMin ?? SHOT_DEFAULTS.tempoSetupMin;

  await prisma.shot.create({
    data: {
      ...parsed.data,
      takesPrevistos,
      duracaoTakeMin,
      tempoSetupMin,
      tempoTotalMin: computeTempoTotal(takesPrevistos, duracaoTakeMin, tempoSetupMin),
      sceneId: scene.id,
      projectId: params.id,
      ordem: (last?.ordem ?? 0) + 1,
    },
  });

  const shots = await recalculateScene(scene.id);

  return NextResponse.json(shots, { status: 201 });
}
