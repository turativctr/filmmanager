import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { mergeLocacoesSchema } from "@/lib/validation/locacao";

const HOSPITAL_FIELDS = ["hospitalNome", "hospitalEndereco", "hospitalTelefone"] as const;

/** Unifica locações: escolhe-se qual registro sobrevive; as cenas dos outros são repontadas pra ele
 *  e os registros absorvidos são removidos. Pontos de apoio dos absorvidos são transferidos pro
 *  sobrevivente (mantendo a ordem relativa, acrescentados ao final). Campos de hospital vazios no
 *  sobrevivente herdam do primeiro absorvido que os tiver preenchidos — nunca sobrescrevendo um
 *  campo já preenchido no sobrevivente. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = mergeLocacoesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { survivorId, absorbedIds } = parsed.data;

  if (absorbedIds.includes(survivorId)) {
    return NextResponse.json({ error: "O registro sobrevivente não pode estar na lista de absorvidos." }, { status: 400 });
  }

  const allIds = [survivorId, ...absorbedIds];
  const locacoes = await prisma.locacao.findMany({ where: { id: { in: allIds }, projectId: params.id } });
  if (locacoes.length !== allIds.length) {
    return NextResponse.json({ error: "Locação inválida para este projeto." }, { status: 400 });
  }

  const survivor = locacoes.find((l) => l.id === survivorId)!;
  const absorbed = absorbedIds.map((id) => locacoes.find((l) => l.id === id)!);

  // Herda campo de hospital vazio do primeiro absorvido que o tiver — nunca sobrescreve o que o
  // sobrevivente já tinha preenchido.
  const hospitalPatch: Record<string, string> = {};
  for (const field of HOSPITAL_FIELDS) {
    if (survivor[field]) continue;
    const donor = absorbed.find((l) => l[field]);
    if (donor) hospitalPatch[field] = donor[field]!;
  }

  const updatedSurvivor = await prisma.$transaction(async (tx) => {
    await tx.scene.updateMany({ where: { locacaoId: { in: absorbedIds } }, data: { locacaoId: survivorId } });

    const survivorPontosCount = await tx.pontoApoio.count({ where: { locacaoId: survivorId } });
    let ordemCursor = survivorPontosCount;
    for (const absorbedId of absorbedIds) {
      const pontos = await tx.pontoApoio.findMany({ where: { locacaoId: absorbedId }, orderBy: { ordem: "asc" } });
      for (const ponto of pontos) {
        await tx.pontoApoio.update({ where: { id: ponto.id }, data: { locacaoId: survivorId, ordem: ordemCursor } });
        ordemCursor += 1;
      }
    }

    if (Object.keys(hospitalPatch).length > 0) {
      await tx.locacao.update({ where: { id: survivorId }, data: hospitalPatch });
    }

    await tx.locacao.deleteMany({ where: { id: { in: absorbedIds } } });

    return tx.locacao.findUniqueOrThrow({ where: { id: survivorId } });
  });

  return NextResponse.json(updatedSurvivor);
}
