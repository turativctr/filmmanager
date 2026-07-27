import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { generateChecklistItems } from "@/lib/ordem-do-dia";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { getShootDayReportData } from "@/lib/report-data";

export async function POST(
  _request: Request,
  { params }: { params: { id: string; shootDayId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const data = await getShootDayReportData(params.id, params.shootDayId);
  if (!data) return NextResponse.json({ error: "Diária não encontrada." }, { status: 404 });

  const generated = generateChecklistItems({
    locacaoNome: data.shootDay.locacaoNome,
    transporteHorario: data.shootDay.transporteHorario,
    transporteEndereco: data.shootDay.transporteEndereco,
    castPresente: data.castPresente,
    scenes: data.scenes,
    characters: data.castPresente,
  });

  const existing = await prisma.shootDayChecklist.findMany({
    where: { shootDayId: params.shootDayId, geradoAutomaticamente: true },
    select: { item: true },
  });
  const existingTexts = new Set(existing.map((e) => e.item));

  const toCreate = generated.filter((g) => !existingTexts.has(g.item));

  if (toCreate.length > 0) {
    await prisma.shootDayChecklist.createMany({
      data: toCreate.map((g) => ({
        shootDayId: params.shootDayId,
        item: g.item,
        tipo: g.tipo,
        geradoAutomaticamente: true,
      })),
    });
  }

  return NextResponse.json({ created: toCreate.length });
}
