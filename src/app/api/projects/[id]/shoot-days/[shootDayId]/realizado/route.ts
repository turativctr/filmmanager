import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { horasDoLancamento, statusDoLancamento } from "@/lib/realizado";
import { lancamentoRealizadoSchema } from "@/lib/validation/realizado";

/** Lançamento do realizado da diária, em lote — a AD preenche no dia seguinte, a partir das
 *  anotações dela. Escreve SÓ execução (status, horaInicioReal, horaFimReal): nada de ordem, bloco,
 *  prep ou Rod passa por aqui, do mesmo jeito que a rota de reordenação nunca toca na execução
 *  (ver src/lib/scene-shoot-day-fields.ts). Lançar de novo corrige o lançamento anterior.
 *
 *  Não chama recalculateDayBlocks: o realizado não desloca o planejamento do dia. O que aconteceu
 *  não reescreve o que estava planejado — é isso que permite comparar os dois depois. */
export async function POST(
  request: Request,
  { params }: { params: { id: string; shootDayId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const shootDay = await prisma.shootDay.findFirst({
    where: { id: params.shootDayId, projectId: params.id },
    select: { id: true },
  });
  if (!shootDay) return NextResponse.json({ error: "Diária não encontrada." }, { status: 404 });

  const parsed = lancamentoRealizadoSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const linhas = parsed.data.linhas;
  const cenas = linhas.flatMap((l) => (l.tipo === "CENA" ? [l] : []));
  const blocos = linhas.flatMap((l) => (l.tipo === "BLOCO" ? [l] : []));

  // Toda linha tem que ser desta diária — a tela manda o que carregou, mas a rota não confia nela.
  const [linhasDoDia, blocosDoDia] = await Promise.all([
    prisma.sceneShootDay.findMany({
      where: { shootDayId: shootDay.id },
      select: { id: true, sceneId: true, scenePartId: true },
    }),
    prisma.shootDayBlock.findMany({ where: { shootDayId: shootDay.id }, select: { id: true } }),
  ]);
  const idPorTira = new Map(linhasDoDia.map((l) => [`${l.sceneId}:${l.scenePartId ?? ""}`, l.id]));
  const idsDeBloco = new Set(blocosDoDia.map((b) => b.id));

  const alvos = cenas.map((c) => ({ linha: c, id: idPorTira.get(`${c.sceneId}:${c.scenePartId ?? ""}`) }));
  if (alvos.some((a) => !a.id) || blocos.some((b) => !idsDeBloco.has(b.blocoId))) {
    return NextResponse.json({ error: "Linha que não pertence a esta diária." }, { status: 400 });
  }

  await prisma.$transaction([
    ...alvos.map((a) =>
      prisma.sceneShootDay.update({
        where: { id: a.id! },
        data: { status: statusDoLancamento(a.linha), ...horasDoLancamento(a.linha) },
      })
    ),
    ...blocos.map((b) =>
      prisma.shootDayBlock.update({
        where: { id: b.blocoId },
        data: { horaInicioReal: b.horaInicioReal, horaFimReal: b.horaFimReal },
      })
    ),
  ]);

  return NextResponse.json({ ok: true, linhas: linhas.length });
}
