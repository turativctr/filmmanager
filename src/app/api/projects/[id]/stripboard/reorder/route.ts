import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { parsePersonagemPrefixed, type CharacterLike } from "@/lib/ordem-do-dia";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { recalculateDayBlocks } from "@/lib/shootday-blocks";
import { stripboardReorderSchema } from "@/lib/validation/stripboard";

/** Alertas automáticos detectados no breakdown/planos da cena, usados pra pré-preencher
 *  SceneShootDay.observacoes na primeira vez que a cena é agendada num dia — ver PATCH desta
 *  rota: o pré-preenchimento só roda pra pares (sceneId, shootDayId) genuinamente novos, nunca
 *  sobrescrevendo notas que o AD já tenha editado. */
async function computePrefillObservacoes(sceneId: string, characters: CharacterLike[]): Promise<string | null> {
  const [breakdown, shots] = await Promise.all([
    prisma.breakdownSheet.findUnique({ where: { sceneId } }),
    prisma.shot.findMany({ where: { sceneId }, orderBy: { ordem: "asc" }, select: { numero: true, tipoReset: true } }),
  ]);

  const lines: string[] = [];

  if (breakdown?.comidaCena.length) {
    lines.push(`Arte: ${breakdown.comidaCena.join(", ")}`);
  }

  const efeitoEspecial = breakdown?.make.filter((m) => m.toLowerCase().includes("efeito")) ?? [];
  if (efeitoEspecial.length) {
    lines.push(`Make: ${efeitoEspecial.join(", ")}`);
  }

  for (const raw of breakdown?.habilidades ?? []) {
    const { character, descricao } = parsePersonagemPrefixed(raw, characters);
    if (character) lines.push(`Elenco: ${character.personagem} — ${descricao}`);
  }

  for (let i = 1; i < shots.length; i++) {
    if (shots[i].tipoReset === "RESET_COMPLETO") {
      lines.push(`Atenção: reset completo entre P${shots[i - 1].numero} e P${shots[i].numero} — verificar continuidade`);
    }
  }

  return lines.length > 0 ? lines.join("\n") : null;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = stripboardReorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { changes } = parsed.data;
  if (changes.length === 0) return NextResponse.json({ ok: true });

  const sceneIds = changes.map((c) => c.sceneId);
  const shootDayIds = [...new Set(changes.map((c) => c.shootDayId).filter(Boolean))] as string[];

  const [scenesCount, shootDaysCount] = await Promise.all([
    prisma.scene.count({ where: { id: { in: sceneIds }, projectId: params.id } }),
    shootDayIds.length
      ? prisma.shootDay.count({ where: { id: { in: shootDayIds }, projectId: params.id } })
      : Promise.resolve(0),
  ]);

  if (scenesCount !== sceneIds.length || shootDaysCount !== shootDayIds.length) {
    return NextResponse.json({ error: "Cena ou diária inválida para este projeto." }, { status: 400 });
  }

  const toCreate = changes.filter((c) => c.shootDayId && c.bloco);

  // Preserva observações existentes (e a flag observacoesAutoGeradas) através do delete+recreate
  // abaixo — sem isso, qualquer drag no Stripboard apagaria as notas do AD. Só pré-preenche pra
  // pares (sceneId, shootDayId) genuinamente novos (a cena nunca esteve nesse dia antes).
  const existing = await prisma.sceneShootDay.findMany({
    where: { sceneId: { in: sceneIds } },
    select: { sceneId: true, shootDayId: true, observacoes: true, observacoesAutoGeradas: true },
  });
  const existingByPair = new Map(existing.map((e) => [`${e.sceneId}:${e.shootDayId}`, e]));

  const characters = toCreate.length
    ? await prisma.character.findMany({
        where: { projectId: params.id },
        select: { id: true, idCurto: true, numeroElenco: true, personagem: true },
      })
    : [];

  const observacoesByPair = new Map<string, { observacoes: string | null; observacoesAutoGeradas: boolean }>();
  for (const change of toCreate) {
    const key = `${change.sceneId}:${change.shootDayId}`;
    const prior = existingByPair.get(key);
    if (prior) {
      observacoesByPair.set(key, { observacoes: prior.observacoes, observacoesAutoGeradas: prior.observacoesAutoGeradas });
    } else {
      const prefill = await computePrefillObservacoes(change.sceneId, characters);
      observacoesByPair.set(key, { observacoes: prefill, observacoesAutoGeradas: prefill !== null });
    }
  }

  // Duas fases: apaga tudo primeiro, depois recria — evita colisão com a
  // constraint única (shootDayId, ordem) ao reordenar/trocar cenas de posição.
  await prisma.$transaction(async (tx) => {
    await tx.sceneShootDay.deleteMany({ where: { sceneId: { in: sceneIds } } });

    if (toCreate.length) {
      await tx.sceneShootDay.createMany({
        data: toCreate.map((change) => {
          const obs = observacoesByPair.get(`${change.sceneId}:${change.shootDayId}`);
          return {
            sceneId: change.sceneId,
            shootDayId: change.shootDayId!,
            bloco: change.bloco!,
            ordem: change.ordem,
            prepMin: change.prepMin ?? undefined,
            rodMin: change.rodMin ?? undefined,
            observacoes: obs?.observacoes ?? null,
            observacoesAutoGeradas: obs?.observacoesAutoGeradas ?? false,
          };
        }),
      });
    }
  });

  // Recalcula blocoManhaInicio/almocoInicio/almocoFim/blocoTardeInicio de toda diária tocada por este
  // reorder — inclui as diárias de ORIGEM das cenas movidas (existingByPair, via shootDayIds antigos),
  // não só as de destino, já que remover uma cena da manhã também desloca o almoço daquele dia.
  const affectedShootDayIds = new Set<string>(shootDayIds);
  for (const entry of existing) {
    if (entry.shootDayId) affectedShootDayIds.add(entry.shootDayId);
  }
  for (const dayId of affectedShootDayIds) {
    await recalculateDayBlocks(dayId);
  }

  return NextResponse.json({ ok: true });
}
