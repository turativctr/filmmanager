/**
 * Recalcula oitavos de cenas importadas com o algoritmo antigo de contagem (que só contava
 * linhas de Action/Dialogue no .fdx, ou media contra margens de página assumidas no PDF — ver
 * lib/fdx-parser.ts e lib/pdf-script-parser.ts pro algoritmo corrigido).
 *
 * O app não guarda o arquivo original do roteiro em lugar nenhum (só o nome, em
 * ScriptDraft.arquivoNome) — por isso este script SEMPRE precisa que o arquivo seja indicado à
 * mão via --file. Sem ele, não adivinha: só marca o projeto com um aviso pro AD decidir se
 * reimporta.
 *
 * Uso:
 *   tsx scripts/recount-eighths.ts --list
 *     Lista projetos com cenas importadas antes desta correção (linhas ainda null no banco).
 *
 *   tsx scripts/recount-eighths.ts --project <id> --file <roteiro.pdf|.fdx|.wdz>
 *     Recalcula as cenas do projeto contra o arquivo indicado, casando por número de cena.
 *     Nunca sobrescreve uma cena com paginasEditadoManualmente=true — preserva e reporta no
 *     final. Cenas do banco sem correspondência no arquivo (número não encontrado) também são
 *     reportadas, não tocadas.
 *
 *   tsx scripts/recount-eighths.ts --mark-all
 *     Marca com oitavosDesatualizados=true todo projeto com cena importada antes da correção e
 *     ainda não marcado — pra quando não há arquivo original disponível pra nenhum deles. Não
 *     recalcula nada.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import { parseFdx } from "../src/lib/fdx-parser";
import { buildScriptFromPdfPages } from "../src/lib/pdf-script-parser";
import { extractFdxXmlFromWdz } from "../src/lib/wdz-parser";
import { extractPdfPagesInNode } from "./lib/extract-pdf-node";

import type { FdxScene } from "../src/lib/fdx-parser";

const prisma = new PrismaClient();

async function listOutdated() {
  const projects = await prisma.project.findMany({
    where: { scenes: { some: { linhas: null } } },
    select: { id: true, titulo: true, oitavosDesatualizados: true, _count: { select: { scenes: true } } },
  });
  if (projects.length === 0) {
    console.log("Nenhum projeto com cenas sem `linhas` preenchido — nada a recontar.");
    return;
  }
  console.log(`${projects.length} projeto(s) com cenas importadas antes da correção de oitavos:\n`);
  for (const p of projects) {
    console.log(`  ${p.id}  "${p.titulo}"  (${p._count.scenes} cenas)${p.oitavosDesatualizados ? "  [já marcado]" : ""}`);
  }
}

async function markAll() {
  const projects = await prisma.project.findMany({
    where: { scenes: { some: { linhas: null } }, oitavosDesatualizados: false },
    select: { id: true, titulo: true },
  });
  if (projects.length === 0) {
    console.log("Nenhum projeto pra marcar.");
    return;
  }
  for (const p of projects) {
    await prisma.project.update({ where: { id: p.id }, data: { oitavosDesatualizados: true } });
    console.log(`Marcado: ${p.id} "${p.titulo}"`);
  }
  console.log(`\n${projects.length} projeto(s) marcado(s) com "contagem desatualizada — reimporte o roteiro".`);
}

async function parseScriptFile(filePath: string): Promise<FdxScene[]> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") {
    const buffer = await readFile(filePath);
    const pages = await extractPdfPagesInNode(buffer);
    return buildScriptFromPdfPages(pages).scenes;
  }
  if (ext === ".fdx") {
    const xml = await readFile(filePath, "utf8");
    return parseFdx(xml).scenes;
  }
  if (ext === ".wdz") {
    const buffer = await readFile(filePath);
    const xml = await extractFdxXmlFromWdz(buffer);
    return parseFdx(xml).scenes;
  }
  throw new Error(`Extensão não suportada: "${ext}". Use .pdf, .fdx ou .wdz.`);
}

async function recountProject(projectId: string, filePath: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    console.error(`Projeto ${projectId} não encontrado.`);
    process.exitCode = 1;
    return;
  }

  const parsedScenes = await parseScriptFile(filePath);
  const parsedByNumero = new Map(parsedScenes.map((s) => [s.numero, s]));
  const existingScenes = await prisma.scene.findMany({ where: { projectId } });

  let updated = 0;
  const preservedList: string[] = [];
  const notFoundList: string[] = [];

  for (const scene of existingScenes) {
    if (scene.paginasEditadoManualmente) {
      preservedList.push(scene.numero);
      continue;
    }
    const match = parsedByNumero.get(scene.numero);
    if (!match) {
      notFoundList.push(scene.numero);
      continue;
    }
    await prisma.scene.update({
      where: { id: scene.id },
      data: {
        paginas: match.paginas.toString(),
        linhas: match.linhas,
        tempoEstimadoMin: match.tempoEstimadoMinSugerido,
      },
    });
    updated += 1;
  }

  await prisma.project.update({ where: { id: projectId }, data: { oitavosDesatualizados: false } });

  console.log(`Projeto "${project.titulo}" (${projectId}):`);
  console.log(`  ${updated} cena(s) recalculada(s)`);
  if (preservedList.length > 0) {
    console.log(`  ${preservedList.length} cena(s) com edição manual preservada(s) (não tocadas): ${preservedList.join(", ")}`);
  }
  if (notFoundList.length > 0) {
    console.log(
      `  ${notFoundList.length} cena(s) do banco sem correspondência no arquivo (número não encontrado, não tocadas): ${notFoundList.join(", ")}`
    );
  }
}

function printUsage() {
  console.error(
    "Uso:\n" +
      "  tsx scripts/recount-eighths.ts --list\n" +
      "  tsx scripts/recount-eighths.ts --project <id> --file <roteiro.pdf|.fdx|.wdz>\n" +
      "  tsx scripts/recount-eighths.ts --mark-all"
  );
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--list")) {
    await listOutdated();
    return;
  }
  if (args.includes("--mark-all")) {
    await markAll();
    return;
  }
  const projectIdx = args.indexOf("--project");
  const fileIdx = args.indexOf("--file");
  if (projectIdx === -1 || fileIdx === -1 || !args[projectIdx + 1] || !args[fileIdx + 1]) {
    printUsage();
    process.exit(1);
  }
  await recountProject(args[projectIdx + 1], args[fileIdx + 1]);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
