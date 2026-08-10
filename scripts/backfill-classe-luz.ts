/**
 * Backfill de Scene.classeLuz pras cenas que a migração 20260810031200 deixou INDEFINIDO por
 * depender de herança (CONTÍNUO, período não reconhecido) — a migração em SQL só classifica
 * palavra a palavra, sem noção de ORDEM do roteiro; herança precisa da ordem, então roda aqui, em
 * TS, reusando a mesma lógica de src/lib/fdx-parser.ts (applyClasseLuzInheritance) em vez de
 * duplicá-la em SQL.
 *
 * Ordena por Scene.numero (natural, numérico) DENTRO do projeto — não por createdAt/ordem de
 * importação: se o AD renumerou ou dividiu uma cena depois de importar, a ordem de criação já não
 * é mais a ordem do roteiro, e herdar do vizinho errado inverteria a classe de luz.
 *
 * Idempotente e não-destrutivo: só ESCREVE cenas que estavam classeLuz=INDEFINIDO E a herança
 * resolveu pra algo melhor; nunca sobrescreve periodo/periodoFim, nunca piora uma cena já
 * resolvida. Roda pra TODOS os projetos por padrão (ou só um, com --project <id>).
 *
 * Uso:
 *   tsx scripts/backfill-classe-luz.ts [--dry-run]
 *   tsx scripts/backfill-classe-luz.ts --project <id> [--dry-run]
 */
import { PrismaClient } from "@prisma/client";

import { applyClasseLuzInheritance } from "../src/lib/fdx-parser";

import type { ClasseLuz } from "../src/lib/fdx-parser";

const prisma = new PrismaClient();

/** Número de cena "natural": parte numérica comparada como número (não como string — "10" tem
 *  que vir depois de "2"), sufixo de letra (cena desdobrada, ex. "12A") comparado depois, como
 *  texto. Numero sem dígito líder (caso raro, cena renomeada à mão) vai pro fim, não quebra a
 *  ordenação das demais. */
function sceneNumeroSortKey(numero: string): [number, string] {
  const match = numero.match(/^(\d+)(.*)$/);
  if (!match) return [Number.MAX_SAFE_INTEGER, numero.trim().toUpperCase()];
  return [parseInt(match[1], 10), match[2].trim().toUpperCase()];
}

function compareSceneNumero(a: string, b: string): number {
  const [an, asuf] = sceneNumeroSortKey(a);
  const [bn, bsuf] = sceneNumeroSortKey(b);
  if (an !== bn) return an - bn;
  return asuf.localeCompare(bsuf, "pt-BR");
}

async function backfillProject(projectId: string, titulo: string, dryRun: boolean) {
  const scenes = await prisma.scene.findMany({
    where: { projectId },
    select: { id: true, numero: true, periodoFim: true, classeLuz: true },
  });
  if (scenes.length === 0) return;

  const ordered = [...scenes].sort((a, b) => compareSceneNumero(a.numero, b.numero));
  // applyClasseLuzInheritance MUTA os objetos que recebe — passamos cópias soltas (não os
  // registros do Prisma) só com os dois campos que ela lê/escreve, pra comparar depois com o
  // valor original e saber exatamente quais linhas precisam de UPDATE.
  const chain = ordered.map((s) => ({ classeLuz: s.classeLuz as ClasseLuz, periodoFim: s.periodoFim }));
  const semHeranca = applyClasseLuzInheritance(chain);

  let atualizadas = 0;
  for (let i = 0; i < ordered.length; i++) {
    if (chain[i].classeLuz === ordered[i].classeLuz) continue;
    atualizadas += 1;
    if (!dryRun) {
      await prisma.scene.update({ where: { id: ordered[i].id }, data: { classeLuz: chain[i].classeLuz } });
    }
  }

  if (atualizadas > 0 || semHeranca > 0) {
    console.log(
      `"${titulo}" (${projectId}): ${atualizadas} cena(s) resolvida(s) por herança` +
        (semHeranca > 0
          ? `, ${semHeranca} continuam INDEFINIDO (sem cena anterior resolvida pra herdar — revisar manualmente)`
          : "") +
        (dryRun ? "  [dry-run, nada gravado]" : "")
    );
  }
}

function printUsage() {
  console.error(
    "Uso:\n" +
      "  tsx scripts/backfill-classe-luz.ts [--dry-run]\n" +
      "  tsx scripts/backfill-classe-luz.ts --project <id> [--dry-run]"
  );
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    printUsage();
    return;
  }
  const dryRun = args.includes("--dry-run");
  const projectIdx = args.indexOf("--project");
  const onlyProjectId = projectIdx >= 0 ? args[projectIdx + 1] : null;
  if (projectIdx >= 0 && !onlyProjectId) {
    printUsage();
    process.exit(1);
  }

  const projects = await prisma.project.findMany({
    where: onlyProjectId ? { id: onlyProjectId } : undefined,
    select: { id: true, titulo: true },
  });
  if (projects.length === 0) {
    console.log(onlyProjectId ? `Projeto ${onlyProjectId} não encontrado.` : "Nenhum projeto encontrado.");
    return;
  }

  for (const p of projects) {
    await backfillProject(p.id, p.titulo, dryRun);
  }
  console.log(`\n${projects.length} projeto(s) verificado(s).${dryRun ? " (dry-run — nada foi gravado)" : ""}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
