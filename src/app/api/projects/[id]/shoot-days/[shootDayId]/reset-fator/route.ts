import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { resetFatorSchema } from "@/lib/validation/shoot-day";

// Rota própria, minúscula — de propósito separada de shoot-days/[shootDayId]/route.ts (que exige
// numeroDia/data via shootDaySchema, não .partial()). Nível 3 de "tempos de reset configuráveis":
// só grava o número, sem nenhum recompute — o fator é lido em tempo real (ver
// getShootDayReportData em src/lib/report-data.ts e os componentes de Stripboard/OD), nunca
// aplicado em Shot/ShotSchedule nem no cálculo de Rod/blocoManha/almoço.
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; shootDayId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const shootDay = await prisma.shootDay.findFirst({
    where: { id: params.shootDayId, projectId: params.id },
  });
  if (!shootDay) return NextResponse.json({ error: "Diária não encontrada." }, { status: 404 });

  const body = await request.json();
  const parsed = resetFatorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.shootDay.update({
    where: { id: shootDay.id },
    data: { fatorResetPercent: parsed.data.fatorResetPercent },
  });

  return NextResponse.json(updated);
}
