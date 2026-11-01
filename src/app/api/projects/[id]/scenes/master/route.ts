import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { deriveClasseLuz } from "@/lib/fdx-parser";
import { naturalCompare } from "@/lib/natural-sort";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { recalculateScene } from "@/lib/shots";
import { masterMulticenaSchema } from "@/lib/validation/scene";

/** O valor que todas as cenas têm em comum, ou null se divergem (ou nenhuma tem). */
function emComum<T>(valores: (T | null)[]): T | null {
  const primeiro = valores[0] ?? null;
  return valores.every((v) => v === primeiro) ? primeiro : null;
}

/** Cria um master de várias cenas: uma cena de produção (origem MASTER_MULTICENA, numerada M1, M2…)
 *  com um plano master dentro, cobrindo as cenas do roteiro escolhidas. Elenco e figuração são a
 *  união das cenas cobertas; locação, INT/EXT e período só são copiados quando todas concordam. Daí
 *  em diante é uma cena como outra qualquer — breakdown, stripboard, Ordem do Dia, planos. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const parsed = masterMulticenaSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const { nome, cenaIds } = parsed.data;

  const cenas = await prisma.scene.findMany({
    where: { id: { in: cenaIds }, projectId: params.id, origem: "ROTEIRO", omitida: false },
    include: { cast: { select: { characterId: true } }, extras: { select: { extraId: true } } },
  });
  if (cenas.length !== new Set(cenaIds).size) {
    return NextResponse.json({ error: "Alguma das cenas escolhidas não é uma cena ativa do roteiro." }, { status: 400 });
  }
  cenas.sort((a, b) => naturalCompare(a.numero, b.numero));

  // Próximo M depois do maior que existe (M1, M2…) — série própria, nunca colide com cena do roteiro.
  const existentes = await prisma.scene.findMany({
    where: { projectId: params.id, numero: { startsWith: "M" } },
    select: { numero: true },
  });
  const maior = existentes.reduce((max, s) => {
    const m = /^M(\d+)$/.exec(s.numero);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  const numero = `M${maior + 1}`;

  const periodo = emComum(cenas.map((c) => c.periodo));
  const { classeLuz, periodoFim } = deriveClasseLuz(periodo);
  const numerosCobertos = cenas.map((c) => c.numero).join(", ");
  const characterIds = [...new Set(cenas.flatMap((c) => c.cast.map((x) => x.characterId)))];
  const extraIds = [...new Set(cenas.flatMap((c) => c.extras.map((x) => x.extraId)))];

  const master = await prisma.scene.create({
    data: {
      projectId: params.id,
      numero,
      origem: "MASTER_MULTICENA",
      set: nome,
      tipo: emComum(cenas.map((c) => c.tipo)),
      periodo,
      periodoFim,
      classeLuz,
      locacaoId: emComum(cenas.map((c) => c.locacaoId)),
      sinopse: `Plano master cobrindo as cenas ${numerosCobertos}.`,
      paginas: "0",
      cast: { create: characterIds.map((characterId) => ({ characterId })) },
      extras: { create: extraIds.map((extraId) => ({ extraId })) },
      cobre: { create: cenas.map((c) => ({ sceneId: c.id })) },
      shots: {
        create: {
          projectId: params.id,
          ordem: 1,
          numero: "1",
          ehMaster: true,
          prioridade: "ESSENCIAL",
          descricao: `${nome} — master das cenas ${numerosCobertos}`,
        },
      },
    },
    select: { id: true, numero: true },
  });

  await recalculateScene(master.id);

  return NextResponse.json(master, { status: 201 });
}
