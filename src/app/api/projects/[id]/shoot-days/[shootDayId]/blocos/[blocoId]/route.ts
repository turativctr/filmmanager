import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { recalculateDayBlocks } from "@/lib/shootday-blocks";
import { shootDayBlockPatchSchema } from "@/lib/validation/shoot-day-block";

type Params = { params: { id: string; shootDayId: string; blocoId: string } };

async function carregar({ params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return { erro: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return { erro: NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 }) };
  const bloco = await prisma.shootDayBlock.findFirst({
    where: { id: params.blocoId, shootDayId: params.shootDayId, shootDay: { projectId: params.id } },
  });
  if (!bloco) return { erro: NextResponse.json({ error: "Bloco não encontrado." }, { status: 404 }) };
  return { bloco };
}

export async function PATCH(request: Request, ctx: Params) {
  const { bloco, erro } = await carregar(ctx);
  if (erro) return erro;

  const parsed = shootDayBlockPatchSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.shootDayBlock.update({ where: { id: bloco.id }, data: parsed.data });
  await recalculateDayBlocks(bloco.shootDayId);
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, ctx: Params) {
  const { bloco, erro } = await carregar(ctx);
  if (erro) return erro;

  await prisma.shootDayBlock.delete({ where: { id: bloco.id } });
  await recalculateDayBlocks(bloco.shootDayId);
  return NextResponse.json({ ok: true });
}
