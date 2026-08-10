/**
 * Limpa locações corrompidas pelo antigo defeito de parse de período: cabeçalhos com um período
 * não reconhecido (ex.: "MADRUGADA", que não existia no enum antigo) ficavam com o período colado
 * no nome da locação inteiro — "CASA; COZINHA - MADRUGADA" virava uma Locacao própria, diferente
 * de "CASA; COZINHA" (cena com período reconhecido, ex. "MANHÃ"), duplicando o que deveria ser a
 * mesma locação física. Ver src/lib/fdx-parser.ts (parseHeading) pro fix do parser em si — este
 * script só corrige o que JÁ está no banco de dados de imports anteriores ao fix.
 *
 * Regras (não negociáveis, ver pedido original):
 *   - Só reprocessa automaticamente uma Locacao cujos campos endereco/contatoNome/
 *     contatoTelefone/notas/hospitalNome/hospitalEndereco/hospitalTelefone estejam TODOS vazios.
 *     Se QUALQUER campo estiver preenchido, a locação NUNCA é tocada — só listada no fim pro AD
 *     resolver manualmente. Roteiro (e o banco resultante dele) é inconsistente por natureza;
 *     adivinhar é pior que perguntar.
 *   - Locacao cujo nome contém " - "/" – "/" — "/" / " (o mesmo separador local/período do
 *     parser): extrai o período e limpa o nome. Se já existe uma Locacao com o nome limpo, as
 *     cenas da suja são repontadas pra ela (e pontos de apoio, se houver) e a suja é removida —
 *     senão, a suja é simplesmente renomeada.
 *   - Roda SÓ no projeto passado como argumento — nunca em todos de uma vez.
 *   - "Antes do Meu Nome nos Créditos" e "Curta-Metragem Piloto" são produção real; exigem
 *     --confirm-named-project além do --project, pra não serem tocadas por engano ao testar o
 *     script contra um projeto qualquer.
 *
 * Uso:
 *   tsx scripts/recount-locacoes.ts --project <id> [--dry-run]
 *   tsx scripts/recount-locacoes.ts --project <id> --confirm-named-project [--dry-run]
 */
import { PrismaClient } from "@prisma/client";

import { normalizeLocacaoNome } from "../src/lib/locacao";

const prisma = new PrismaClient();

// Mesmo separador de src/lib/fdx-parser.ts (LOCAL_PERIODO_SEPARATOR) — duplicado aqui de
// propósito: é um detalhe de UMA linha, não vale exportar só pra um script de limpeza único.
const LOCAL_PERIODO_SEPARATOR = /\s+(?:[-–—]|\/)\s+/g;

const NOMES_PROTEGIDOS = ["Antes do Meu Nome nos Créditos", "Curta-Metragem Piloto"];

const CAMPOS_MANUAIS = [
  "endereco",
  "contatoNome",
  "contatoTelefone",
  "notas",
  "hospitalNome",
  "hospitalEndereco",
  "hospitalTelefone",
] as const;

type LocacaoRow = {
  id: string;
  nome: string;
  endereco: string | null;
  contatoNome: string | null;
  contatoTelefone: string | null;
  notas: string | null;
  hospitalNome: string | null;
  hospitalEndereco: string | null;
  hospitalTelefone: string | null;
};

function temCampoManual(l: LocacaoRow): boolean {
  return CAMPOS_MANUAIS.some((f) => {
    const v = l[f];
    return v != null && v.trim() !== "";
  });
}

/** Extrai o nome limpo de uma Locacao cujo nome ainda carrega o período colado — mesma lógica de
 *  divisão do parser (último separador corta local/período), sem validar o período contra
 *  nenhuma lista: se há separador, tudo depois dele é período e é descartado do nome. */
function nomeLimpo(nome: string): string | null {
  const matches = [...nome.matchAll(LOCAL_PERIODO_SEPARATOR)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  const lastIndex = last.index ?? 0;
  const before = nome.slice(0, lastIndex).trim();
  const after = nome.slice(lastIndex + last[0].length).trim();
  if (!before || !after) return null;
  return normalizeLocacaoNome(before);
}

async function recountProject(projectId: string, dryRun: boolean) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, titulo: true } });
  if (!project) {
    console.error(`Projeto ${projectId} não encontrado.`);
    process.exitCode = 1;
    return;
  }

  const locacoes = await prisma.locacao.findMany({ where: { projectId }, select: {
    id: true, nome: true, endereco: true, contatoNome: true, contatoTelefone: true, notas: true,
    hospitalNome: true, hospitalEndereco: true, hospitalTelefone: true,
  } });
  const porNomeNormalizado = new Map<string, LocacaoRow>();
  for (const l of locacoes) {
    const key = normalizeLocacaoNome(l.nome);
    // Em caso de colisão (duas linhas já normalizadas pro mesmo nome — não deveria acontecer,
    // mas não é este script quem resolve isso), a primeira encontrada vira o alvo de fusão.
    if (!porNomeNormalizado.has(key)) porNomeNormalizado.set(key, l);
  }

  let renomeadas = 0;
  let fundidas = 0;
  const puladas: string[] = [];

  for (const locacao of locacoes) {
    const limpo = nomeLimpo(locacao.nome);
    if (!limpo || limpo === normalizeLocacaoNome(locacao.nome)) continue; // nome já está limpo

    if (temCampoManual(locacao)) {
      puladas.push(`${locacao.nome} (id ${locacao.id}) — tem campo preenchido à mão, revisar manualmente`);
      continue;
    }

    const existente = porNomeNormalizado.get(limpo);
    if (existente && existente.id !== locacao.id) {
      console.log(`FUNDIR: "${locacao.nome}" (${locacao.id}) → "${existente.nome}" (${existente.id})`);
      fundidas += 1;
      if (!dryRun) {
        await prisma.$transaction(async (tx) => {
          await tx.scene.updateMany({ where: { locacaoId: locacao.id }, data: { locacaoId: existente.id } });
          const sobrevivPontosCount = await tx.pontoApoio.count({ where: { locacaoId: existente.id } });
          const pontos = await tx.pontoApoio.findMany({ where: { locacaoId: locacao.id }, orderBy: { ordem: "asc" } });
          for (let i = 0; i < pontos.length; i++) {
            await tx.pontoApoio.update({
              where: { id: pontos[i].id },
              data: { locacaoId: existente.id, ordem: sobrevivPontosCount + i },
            });
          }
          await tx.locacao.delete({ where: { id: locacao.id } });
        });
      }
    } else {
      console.log(`RENOMEAR: "${locacao.nome}" (${locacao.id}) → "${limpo}"`);
      renomeadas += 1;
      if (!dryRun) {
        await prisma.locacao.update({ where: { id: locacao.id }, data: { nome: limpo } });
      }
      // Registra o novo nome limpo no mapa — uma segunda locação suja com o mesmo nome limpo
      // (ex.: duas variações de período pro mesmo local) deve fundir com ESTA a partir daqui,
      // não criar outra renomeação solta.
      porNomeNormalizado.set(limpo, { ...locacao, nome: limpo });
    }
  }

  console.log(`\nProjeto "${project.titulo}" (${projectId}):`);
  console.log(`  ${renomeadas} locação(ões) renomeada(s)`);
  console.log(`  ${fundidas} locação(ões) fundida(s) numa já existente`);
  if (puladas.length > 0) {
    console.log(`  ${puladas.length} locação(ões) pulada(s) — resolver manualmente:`);
    for (const p of puladas) console.log(`    - ${p}`);
  }
  if (dryRun) console.log("  [dry-run, nada gravado]");
}

function printUsage() {
  console.error(
    "Uso:\n" +
      "  tsx scripts/recount-locacoes.ts --project <id> [--dry-run]\n" +
      "  tsx scripts/recount-locacoes.ts --project <id> --confirm-named-project [--dry-run]"
  );
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const confirmNamed = args.includes("--confirm-named-project");
  const projectIdx = args.indexOf("--project");
  const projectId = projectIdx >= 0 ? args[projectIdx + 1] : null;
  if (!projectId) {
    printUsage();
    process.exit(1);
  }

  // Comparação case-insensitive de propósito — o título real no banco pode não bater
  // caractere-a-caractere com a grafia usada aqui (ex.: guardado em CAIXA ALTA). Confiar num
  // match exato deixaria a proteção silenciosamente inerte pro título real.
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { titulo: true } });
  const protegido = project && NOMES_PROTEGIDOS.some((n) => n.toUpperCase() === project.titulo.toUpperCase());
  if (protegido && !confirmNamed) {
    console.error(
      `"${project.titulo}" é produção real (protegida por padrão). Rode de novo com ` +
        `--confirm-named-project se realmente quer processar este projeto.`
    );
    process.exit(1);
  }

  await recountProject(projectId, dryRun);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
