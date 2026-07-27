import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { moveScenesSchema } from "@/lib/validation/locacao";

/** "Separar": move só as cenas selecionadas pra outra locação (existente ou recém-criada) — a
 *  locação de origem continua existindo com o que sobrou. Caso central: o roteiro escreveu
 *  "EXT. RUA" cinco vezes e a produção descobriu que são três ruas diferentes. */
export async function POST(
  request: Request,
  { params }: { params: { id: string; locacaoId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = moveScenesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { sceneIds, targetLocacaoId } = parsed.data;

  const target = await prisma.locacao.findFirst({ where: { id: targetLocacaoId, projectId: params.id } });
  if (!target) return NextResponse.json({ error: "Locação de destino inválida." }, { status: 400 });

  const scenesCount = await prisma.scene.count({
    where: { id: { in: sceneIds }, projectId: params.id, locacaoId: params.locacaoId },
  });
  if (scenesCount !== sceneIds.length) {
    return NextResponse.json({ error: "Cena inválida para esta locação." }, { status: 400 });
  }

  await prisma.scene.updateMany({
    where: { id: { in: sceneIds }, locacaoId: params.locacaoId },
    data: { locacaoId: targetLocacaoId },
  });

  return NextResponse.json({ ok: true });
}
