import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { naturalCompare } from "@/lib/natural-sort";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { masterCoberturaSchema } from "@/lib/validation/scene";

/** Troca a lista de cenas que um master de várias cenas cobre. Elenco e locação do master já são
 *  dele desde a criação e não são recalculados aqui (a AD pode ter editado). */
export async function PUT(request: Request, { params }: { params: { id: string; sceneId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const master = await prisma.scene.findFirst({
    where: { id: params.sceneId, projectId: params.id, origem: "MASTER_MULTICENA" },
  });
  if (!master) return NextResponse.json({ error: "Master não encontrado." }, { status: 404 });

  const parsed = masterCoberturaSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const cenaIds = [...new Set(parsed.data.cenaIds)];

  const validas = await prisma.scene.findMany({
    where: { id: { in: cenaIds }, projectId: params.id, origem: "ROTEIRO" },
    select: { numero: true },
  });
  if (validas.length !== cenaIds.length) {
    return NextResponse.json({ error: "Alguma das cenas escolhidas não é uma cena do roteiro." }, { status: 400 });
  }

  // A sinopse gerada na criação lista as cenas cobertas — acompanha a troca enquanto a AD não a
  // reescreveu (texto ainda no formato automático); texto dela nunca é sobrescrito.
  const numeros = validas.map((c) => c.numero).sort(naturalCompare).join(", ");
  const sinopseAutomatica = master.sinopse === null || /^Plano master cobrindo as cenas .*\.$/.test(master.sinopse);

  await prisma.$transaction([
    prisma.sceneCobertura.deleteMany({ where: { masterSceneId: master.id } }),
    prisma.sceneCobertura.createMany({ data: cenaIds.map((sceneId) => ({ masterSceneId: master.id, sceneId })) }),
    ...(sinopseAutomatica
      ? [prisma.scene.update({ where: { id: master.id }, data: { sinopse: `Plano master cobrindo as cenas ${numeros}.` } })]
      : []),
  ]);

  return NextResponse.json({ ok: true });
}
