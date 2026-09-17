import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { recalculateDayBlocks } from "@/lib/shootday-blocks";
import { shootDayBlockSchema } from "@/lib/validation/shoot-day-block";

/** Cria um bloco de tempo livre no FIM da diária (a AD arrasta pra posição depois), do mesmo lado do
 *  almoço que o último item do dia. */
export async function POST(request: Request, { params }: { params: { id: string; shootDayId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const shootDay = await prisma.shootDay.findFirst({
    where: { id: params.shootDayId, projectId: params.id },
    include: { scenes: { select: { ordem: true, bloco: true } }, blocos: { select: { ordem: true, bloco: true } } },
  });
  if (!shootDay) return NextResponse.json({ error: "Diária não encontrada." }, { status: 404 });

  const parsed = shootDayBlockSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const itens = [...shootDay.scenes, ...shootDay.blocos].sort((a, b) => a.ordem - b.ordem);
  const ultimo = itens[itens.length - 1];

  const bloco = await prisma.shootDayBlock.create({
    data: {
      shootDayId: shootDay.id,
      rotulo: parsed.data.rotulo,
      duracaoMin: parsed.data.duracaoMin,
      ordem: ultimo ? ultimo.ordem + 1 : 0,
      bloco: ultimo?.bloco ?? "MANHA",
    },
  });
  await recalculateDayBlocks(shootDay.id);

  return NextResponse.json(bloco, { status: 201 });
}
