import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { syncSceneRodMin } from "@/lib/shots";
import { sceneDuracaoAlvoSchema } from "@/lib/validation/scene";

/** Tempo reverso da cena. Grava Scene.duracaoAlvoMin e propaga pro Rod de toda diária onde a cena
 *  está (ver syncSceneRodMin) — nunca toca nos tempos dos planos: a média por plano é só exibida. */
export async function PATCH(request: Request, { params }: { params: { id: string; sceneId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const scene = await prisma.scene.findFirst({ where: { id: params.sceneId, projectId: params.id } });
  if (!scene) return NextResponse.json({ error: "Cena não encontrada." }, { status: 404 });

  const body = await request.json();
  const parsed = sceneDuracaoAlvoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.scene.update({
    where: { id: scene.id },
    data: { duracaoAlvoMin: parsed.data.duracaoAlvoMin },
    select: { id: true, duracaoAlvoMin: true },
  });

  // Apagar o alvo numa cena sem planos devolve o Rod pro tempo estimado por oitavos, em vez de
  // deixar o alvo apagado valendo em silêncio no cronograma.
  await syncSceneRodMin(scene.id, undefined, { semNadaVolta: parsed.data.duracaoAlvoMin === null });

  return NextResponse.json(updated);
}
