/**
 * Verifica a lógica pura de master/coverage (agrupamento e numeração) e do tempo reverso por cena
 * — tudo que não depende de banco. Os casos de numeração vêm dos dados reais: a cena 3 do ANTES DO
 * MEU NOME é filmada na ordem 6,7,5,4,1,2,3, e o número é a identidade do plano (claquete), nunca
 * a posição.
 *
 *   npm run verify:planos
 */
import { resolveEffectiveRodMin } from "../src/lib/schedule";
import {
  computeCortaveisMin,
  coverageShotNumero,
  nextFreeShotNumero,
  normalizeShotOrder,
  resolveRodDaCena,
} from "../src/lib/shots-shared";
import {
  avaliarTempoAlvo,
  formatDuracaoCurta,
  mensagemMedia,
  mensagemSaldo,
  mensagemSetupAcimaDaMedia,
} from "../src/lib/tempo-alvo";

let falhas = 0;
function check(nome: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) falhas++;
  console.log(`  ${ok ? "OK  " : "FORA"} ${nome}${ok ? "" : ` — veio ${JSON.stringify(got)}, esperado ${JSON.stringify(want)}`}`);
}

type S = { id: string; planoPaiId: string | null };
const s = (id: string, planoPaiId: string | null = null): S => ({ id, planoPaiId });
const ids = (list: S[]) => list.map((x) => x.id);

console.log("\n=== Agrupamento (normalizeShotOrder) ===");
check("lista plana não muda", ids(normalizeShotOrder([s("1"), s("2"), s("3")])), ["1", "2", "3"]);
check(
  "coverage fora do grupo volta pra baixo do pai",
  ids(normalizeShotOrder([s("2"), s("1"), s("2A", "2"), s("3"), s("2B", "2")])),
  ["2", "2A", "2B", "1", "3"]
);
check(
  "arrastar o pai pro fim leva os coverages",
  ids(normalizeShotOrder([s("1"), s("3"), s("2"), s("2A", "2"), s("2B", "2")].filter((x) => x.id !== "2").concat([s("2")]))),
  ["1", "3", "2", "2A", "2B"]
);
check(
  "reordenar irmãos respeita a ordem nova",
  ids(normalizeShotOrder([s("2"), s("2B", "2"), s("2A", "2"), s("1")])),
  ["2", "2B", "2A", "1"]
);
check(
  "coverage de pai inexistente vira solto, nenhum plano some",
  ids(normalizeShotOrder([s("1"), s("X", "fantasma"), s("2")])),
  ["1", "X", "2"]
);
check(
  "dado inválido de 2 níveis não perde plano",
  ids(normalizeShotOrder([s("1"), s("1A", "1"), s("1A1", "1A")])).sort(),
  ["1", "1A", "1A1"]
);

console.log("\n=== Numeração: número é identidade, não posição ===");
const cena3 = ["6", "7", "5", "4", "1", "2", "3"]; // ordem de filmagem real
check("plano novo na cena 3 do ADMNNC recebe 8 (não a posição)", nextFreeShotNumero(cena3), "8");
check("o 6 de 6A conta", nextFreeShotNumero(["1", "6A"]), "7");
check("nunca reaproveita buraco (3 apagado)", nextFreeShotNumero(["1", "2", "4"]), "5");
check("cena vazia começa em 1", nextFreeShotNumero([]), "1");
check("primeiro coverage do 6", coverageShotNumero("6", cena3), "6A");
check("segundo coverage do 6", coverageShotNumero("6", [...cena3, "6A"]), "6B");
check("não duplica 6A digitado solto", coverageShotNumero("6", [...cena3, "6A"]), "6B");
check("letra liberada é reaproveitada dentro do grupo", coverageShotNumero("6", [...cena3, "6B"]), "6A");

console.log("\n=== Tempo reverso ===");
check("3min20 (não 3,3min)", formatDuracaoCurta(200), "3min20");
check("minuto cheio", formatDuracaoCurta(180), "3min");
check("segundos com zero à esquerda", formatDuracaoCurta(185), "3min05");
check("menos de 1 minuto", formatDuracaoCurta(40), "40s");

const planos = [
  { id: "a", rotulo: "Plano 1", setupMin: 0 },
  { id: "b", rotulo: "Plano 2", setupMin: 7 },
  { id: "c", rotulo: "Plano 2A", setupMin: 3 }, // coverage conta como plano
];
const estouro = avaliarTempoAlvo({ alvoMin: 10, somaMin: 22, partes: planos });
check("média do exemplo", mensagemMedia(estouro, "plano", "planos"), "10min para 3 planos · ~3min20 por plano");
check("estouro", mensagemSaldo(estouro, "A cena", "os planos"), "Estourou em 12min. A cena tem 10min e os planos somam 22min.");
check("só o setup de 7min passa da média", estouro.setupsAcimaDaMedia.map((p) => p.id), ["b"]);
check(
  "mensagem de setup",
  mensagemSetupAcimaDaMedia(7, estouro.mediaSeg!),
  "setup de 7min não cabe em ~3min20"
);
check("setup de 3min cabe em 3min20", estouro.setupsAcimaDaMedia.some((p) => p.id === "c"), false);

const sobra = avaliarTempoAlvo({ alvoMin: 10, somaMin: 7, partes: planos });
check("sobra", mensagemSaldo(sobra, "A cena", "os planos"), "Sobram 3min.");
check("exato não é estouro", mensagemSaldo(avaliarTempoAlvo({ alvoMin: 10, somaMin: 10, partes: planos }), "A cena", "os planos"), "Sobram 0min.");
check("sem planos não divide por zero", avaliarTempoAlvo({ alvoMin: 10, somaMin: 0, partes: [] }).mediaSeg, null);
check("mensagem sem planos", mensagemMedia(avaliarTempoAlvo({ alvoMin: 10, somaMin: 0, partes: [] }), "plano", "planos"), "10min · nenhum plano ainda");
check("singular", mensagemMedia(avaliarTempoAlvo({ alvoMin: 10, somaMin: 0, partes: [planos[0]] }), "plano", "planos"), "10min para 1 plano · ~10min por plano");
check("mais de uma hora", mensagemMedia(avaliarTempoAlvo({ alvoMin: 125, somaMin: 0, partes: [planos[0]] }), "plano", "planos"), "2h05 para 1 plano · ~2h05 por plano");

console.log("\n=== Rod da cena: os três estados ===");
// Rod EFETIVO = o que o cronograma usa: o valor gravado, ou o estimado pelos oitavos quando null.
const TEMPO_ESTIMADO = 90;
const rodEfetivo = (r: { rodMin: number | null }) => resolveEffectiveRodMin(r.rodMin, TEMPO_ESTIMADO);
const plano = (tempoTotalMin: number, tempoResetMin: number, status: "PENDENTE" | "FILMADO" | "DESCARTADO" = "PENDENTE") => ({
  tempoTotalMin,
  tempoResetMin,
  tempoResetMinManual: null,
  takesPrevistos: 3,
  status,
});
const doisPlanos = [plano(6, 0), plano(20, 8), plano(99, 0, "DESCARTADO")];

let rod = resolveRodDaCena({ duracaoAlvoMin: null, planos: doisPlanos });
check("com planos, sem alvo → soma dos planos (6 + 20 + reset 8, sem o descartado)", [rod.fonte, rodEfetivo(rod)], ["PLANOS", 34]);
rod = resolveRodDaCena({ duracaoAlvoMin: null, planos: [] });
check("sem planos, sem alvo → estimado pelos oitavos (o bug: ficava a soma antiga)", [rod.fonte, rod.rodMin, rodEfetivo(rod)], ["ESTIMADO", null, 90]);
rod = resolveRodDaCena({ duracaoAlvoMin: 10, planos: doisPlanos });
check("com alvo e com planos → alvo", [rod.fonte, rodEfetivo(rod)], ["DEFINIDO", 10]);
rod = resolveRodDaCena({ duracaoAlvoMin: 10, planos: [] });
check("com alvo e sem planos → alvo", [rod.fonte, rodEfetivo(rod)], ["DEFINIDO", 10]);

console.log("\n=== Cortáveis (Desejável + Se der tempo) ===");
const comPrioridade = (
  p: "ESSENCIAL" | "DESEJAVEL" | "SE_DER_TEMPO",
  tempoTotalMin: number,
  tempoResetMin = 0,
  status: "PENDENTE" | "FILMADO" | "DESCARTADO" = "PENDENTE"
) => ({ ...plano(tempoTotalMin, tempoResetMin, status), prioridade: p });
const cena19 = [
  comPrioridade("ESSENCIAL", 30, 0),
  comPrioridade("DESEJAVEL", 20, 5), // reset entra na conta
  comPrioridade("SE_DER_TEMPO", 15, 0),
  comPrioridade("SE_DER_TEMPO", 40, 0, "DESCARTADO"), // descartado não conta
  comPrioridade("DESEJAVEL", 25, 3, "FILMADO"), // já filmado: cortar não economiza nada
];
check("desejável + se der tempo, com reset, sem descartado nem filmado", computeCortaveisMin(cena19), 40);
check("tudo essencial → 0", computeCortaveisMin([comPrioridade("ESSENCIAL", 30), comPrioridade("ESSENCIAL", 10, 4)]), 0);
check("sem planos → 0", computeCortaveisMin([]), 0);
check(
  "cortáveis nunca passam do Rod pela soma",
  computeCortaveisMin(cena19) <= resolveRodDaCena({ duracaoAlvoMin: null, planos: cena19 }).rodMin!,
  true
);

console.log(`\n${falhas === 0 ? "TUDO OK" : `FALHOU (${falhas})`}`);
process.exit(falhas === 0 ? 0 : 1);
