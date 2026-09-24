import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { recalculateDayBlocks } from "@/lib/shootday-blocks";
import { shootDayPlanejamentoSchema, shootDaySchema } from "@/lib/validation/shoot-day";

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

  // Teto e modo do planejamento (modo simplificado): payload parcial, reconhecido por não trazer
  // numeroDia/data — o formulário completo da diária sempre traz os dois.
  if (body && typeof body === "object" && !("numeroDia" in body) && !("data" in body)) {
    const plano = shootDayPlanejamentoSchema.safeParse(body);
    if (!plano.success) {
      return NextResponse.json({ error: plano.error.flatten() }, { status: 400 });
    }
    const { jornadaMin, horaFimAlvo, modoPlanejamento, reservaMin } = plano.data;
    // Um OU outro: gravar um teto limpa o outro, senão sobraria um teto antigo escondido.
    const teto =
      jornadaMin != null
        ? { jornadaMin, horaFimAlvo: null }
        : horaFimAlvo != null
          ? { jornadaMin: null, horaFimAlvo }
          : { ...(jornadaMin === null ? { jornadaMin: null } : {}), ...(horaFimAlvo === null ? { horaFimAlvo: null } : {}) };
    // Sem recalculateDayBlocks: o teto só avisa e o modo só muda a tela — nenhum horário depende deles.
    const updated = await prisma.shootDay.update({
      where: { id: shootDay.id },
      data: {
        ...teto,
        ...(modoPlanejamento ? { modoPlanejamento } : {}),
        ...(reservaMin !== undefined ? { reservaMin } : {}),
      },
      select: { jornadaMin: true, horaFimAlvo: true, modoPlanejamento: true, reservaMin: true },
    });
    return NextResponse.json(updated);
  }

  const parsed = shootDaySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, ...rest } = parsed.data;

  if (rest.numeroDia !== shootDay.numeroDia) {
    const duplicate = await prisma.shootDay.findFirst({
      where: { projectId: params.id, numeroDia: rest.numeroDia, NOT: { id: shootDay.id } },
    });
    if (duplicate) {
      return NextResponse.json({ error: "Já existe uma diária com esse número." }, { status: 409 });
    }
  }

  await prisma.shootDay.update({
    where: { id: shootDay.id },
    data: { ...rest, data: new Date(data) },
  });

  // chamadaGeral pode ter mudado — blocoManhaInicio/almocoInicio/almocoFim/blocoTardeInicio são
  // sempre derivados dela (+ Jornada do projeto + cenas da manhã), nunca editados diretamente aqui.
  const recalculated = await recalculateDayBlocks(shootDay.id);

  return NextResponse.json(recalculated);
}

export async function DELETE(
  _request: Request,
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

  await prisma.shootDay.delete({ where: { id: shootDay.id } });

  return NextResponse.json({ ok: true });
}
