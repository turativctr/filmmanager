import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { getDivisaoDaCena, mensagemProblemaDivisao, paginasParaOitavos, validarDivisao } from "@/lib/scene-parts";
import { syncSceneRodMin } from "@/lib/shots";
import { sceneDivisionSchema } from "@/lib/validation/scene-part";

async function carregar(params: { id: string; sceneId: string }) {
  const session = await getServerSession(authOptions);
  if (!session) return { erro: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return { erro: NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 }) };
  const scene = await prisma.scene.findFirst({
    where: { id: params.sceneId, projectId: params.id },
    include: { parts: { include: { sceneShootDay: { include: { shootDay: { select: { numeroDia: true } } } } } } },
  });
  if (!scene) return { erro: NextResponse.json({ error: "Cena não encontrada." }, { status: 404 }) };
  return { scene };
}

export async function GET(_request: Request, { params }: { params: { id: string; sceneId: string } }) {
  const { erro } = await carregar(params);
  if (erro) return erro;
  return NextResponse.json(await getDivisaoDaCena(params.sceneId));
}

/** Cria ou edita a divisão inteira de uma vez. Parte com `id` é mantida (diária e planos continuam
 *  com ela); sem `id` é nova; parte existente que não veio é removida — barrado se ela estiver
 *  agendada, pra nunca apagar agenda em silêncio. A soma dos oitavos tem que fechar com a cena. */
export async function PUT(request: Request, { params }: { params: { id: string; sceneId: string } }) {
  const { scene, erro } = await carregar(params);
  if (erro) return erro;

  const parsed = sceneDivisionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { partes } = parsed.data;

  const oitavosCena = paginasParaOitavos(scene.paginas);
  const problemas = validarDivisao(oitavosCena, partes);
  if (problemas.length > 0) {
    return NextResponse.json({ error: problemas.map((p) => mensagemProblemaDivisao(p, partes)).join(" ") }, { status: 400 });
  }

  const existentes = new Map(scene.parts.map((p) => [p.id, p]));
  for (const p of partes) {
    if (p.id && !existentes.has(p.id)) {
      return NextResponse.json({ error: "Parte não pertence a esta cena." }, { status: 400 });
    }
  }
  const idsMantidos = new Set(partes.map((p) => p.id).filter(Boolean));
  const removidas = scene.parts.filter((p) => !idsMantidos.has(p.id));
  const removidaAgendada = removidas.find((p) => p.sceneShootDay);
  if (removidaAgendada) {
    return NextResponse.json(
      {
        error: `"${removidaAgendada.rotulo}" está na diária ${removidaAgendada.sceneShootDay!.shootDay.numeroDia}. Tire a parte da diária antes de removê-la.`,
      },
      { status: 400 }
    );
  }

  const eraInteira = scene.parts.length === 0;
  // A cena já agendada antes de ser dividida (linha sem parte) passa a agendar a primeira parte —
  // senão a diária perderia a cena ao dividir.
  const linhaSemParte = eraInteira
    ? await prisma.sceneShootDay.findFirst({ where: { sceneId: scene.id, scenePartId: null } })
    : null;

  await prisma.$transaction(async (tx) => {
    if (removidas.length > 0) await tx.scenePart.deleteMany({ where: { id: { in: removidas.map((p) => p.id) } } });
    const ids: string[] = [];
    for (const [i, p] of partes.entries()) {
      if (p.id) {
        await tx.scenePart.update({ where: { id: p.id }, data: { rotulo: p.rotulo, oitavos: p.oitavos, ordem: i + 1 } });
        ids.push(p.id);
      } else {
        const criada = await tx.scenePart.create({
          data: { sceneId: scene.id, rotulo: p.rotulo, oitavos: p.oitavos, ordem: i + 1 },
        });
        ids.push(criada.id);
      }
    }
    if (linhaSemParte) {
      await tx.sceneShootDay.update({ where: { id: linhaSemParte.id }, data: { scenePartId: ids[0] } });
    }
  });

  // Rod de cada parte agendada passa a ser o da parte (transição: vale também o estimado).
  await syncSceneRodMin(scene.id, undefined, { semNadaVolta: true });

  return NextResponse.json(await getDivisaoDaCena(scene.id));
}

/** Desfaz a divisão: a cena volta a ser inteira. Só com no máximo uma parte agendada — a cena
 *  inteira cabe em uma diária só, e escolher qual agenda apagar é decisão da AD, não do servidor. */
export async function DELETE(_request: Request, { params }: { params: { id: string; sceneId: string } }) {
  const { scene, erro } = await carregar(params);
  if (erro) return erro;
  if (scene.parts.length === 0) return NextResponse.json(await getDivisaoDaCena(scene.id));

  const agendadas = scene.parts.filter((p) => p.sceneShootDay);
  if (agendadas.length > 1) {
    return NextResponse.json(
      {
        error: `A cena está em ${agendadas.length} diárias (${agendadas
          .map((p) => `${p.rotulo}: diária ${p.sceneShootDay!.shootDay.numeroDia}`)
          .join(", ")}). Deixe só uma parte agendada antes de desfazer a divisão.`,
      },
      { status: 400 }
    );
  }

  // SetNull no schema solta a linha da diária e os planos; a cena fica agendada onde a parte estava.
  await prisma.scenePart.deleteMany({ where: { sceneId: scene.id } });
  await syncSceneRodMin(scene.id, undefined, { semNadaVolta: true });

  return NextResponse.json(await getDivisaoDaCena(scene.id));
}
