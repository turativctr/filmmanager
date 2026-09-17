/**
 * Filtro do Boneyard — E entre critérios, OU dentro de cada critério, parte de cena dividida herda
 * locação, classeLuz e elenco da cena.
 *
 *   npm run verify:boneyard
 */
import { FILTRO_VAZIO, filtroAtivo, passaNoFiltro, SEM_LOCACAO } from "../src/components/stripboard/boneyard-filter";
import type { StripItem } from "../src/components/stripboard/types";

let falhas = 0;
function check(nome: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) falhas++;
  console.log(`  ${ok ? "OK  " : "FORA"} ${nome}${ok ? "" : ` — veio ${JSON.stringify(got)}, esperado ${JSON.stringify(want)}`}`);
}

function tira(
  numero: string,
  { locacaoId = null, locacao = null, classeLuz = "DIA", elenco = [], parte = null }: {
    locacaoId?: string | null;
    locacao?: string | null;
    classeLuz?: StripItem["scene"]["classeLuz"];
    elenco?: string[];
    parte?: string | null;
  } = {}
): StripItem {
  return {
    itemId: `${numero}${parte ?? ""}`,
    sceneId: numero,
    scenePartId: parte,
    parte: parte ? ({ rotulo: parte } as StripItem["parte"]) : null,
    prepMin: null,
    rodMin: null,
    shotsSummary: null,
    scene: {
      numero,
      locacaoId,
      locacao,
      classeLuz,
      characterIds: elenco,
    } as StripItem["scene"],
  };
}

const bananeira = { locacaoId: "L1", locacao: "Restaurante Bananeira" };
const cenas = [
  tira("3", { ...bananeira, classeLuz: "DIA", elenco: ["chef"] }),
  tira("7", { ...bananeira, classeLuz: "NOITE", elenco: ["chef", "ben"] }),
  tira("12", { locacaoId: "L2", locacao: "Apartamento Akemi", classeLuz: "NOITE", elenco: ["akemi"] }),
  tira("19", { locacaoId: "L2", locacao: "Apartamento Akemi", classeLuz: "DIA", elenco: ["akemi"], parte: "Voice off" }),
  tira("21", { classeLuz: "TRANSICAO" }),
];
// "chef" → "CHEF" etc.: o ID que a AD lê na tira, não o id interno do personagem.
const idDoElenco = (id: string) => id.slice(0, 3).toUpperCase();
const numeros = (f: Parameters<typeof passaNoFiltro>[1]) =>
  cenas
    .filter((c) => passaNoFiltro(c, f, idDoElenco))
    .map((c) => (c.parte ? `${c.scene.numero} · ${c.parte.rotulo}` : c.scene.numero));

console.log("\n=== Critérios ===");
check("sem filtro: tudo, e não conta como ativo", [numeros(FILTRO_VAZIO), filtroAtivo(FILTRO_VAZIO)], [["3", "7", "12", "19 · Voice off", "21"], false]);
check("locação (OU dentro)", numeros({ ...FILTRO_VAZIO, locacaoIds: ["L1", "L2"] }), ["3", "7", "12", "19 · Voice off"]);
check("sem locação definida", numeros({ ...FILTRO_VAZIO, locacaoIds: [SEM_LOCACAO] }), ["21"]);
check("noite", numeros({ ...FILTRO_VAZIO, classesLuz: ["NOITE"] }), ["7", "12"]);
check("elenco (OU dentro): ben ou akemi", numeros({ ...FILTRO_VAZIO, characterIds: ["ben", "akemi"] }), ["7", "12", "19 · Voice off"]);
check("E entre critérios: Bananeira E noite E chef", numeros({ ...FILTRO_VAZIO, locacaoIds: ["L1"], classesLuz: ["NOITE"], characterIds: ["chef"] }), ["7"]);
check("E que zera", numeros({ ...FILTRO_VAZIO, locacaoIds: ["L1"], characterIds: ["akemi"] }), []);

console.log("\n=== Busca ===");
check("número da cena", numeros({ ...FILTRO_VAZIO, busca: "12" }), ["12"]);
check("rótulo da parte, sem acento/caixa", numeros({ ...FILTRO_VAZIO, busca: "VOICE" }), ["19 · Voice off"]);
check("nome da locação, sem acento", numeros({ ...FILTRO_VAZIO, busca: "apartamento" }), ["12", "19 · Voice off"]);
check("busca combina com critério (E)", numeros({ ...FILTRO_VAZIO, busca: "apartamento", classesLuz: ["DIA"] }), ["19 · Voice off"]);
check("busca só de espaços não filtra", filtroAtivo({ ...FILTRO_VAZIO, busca: "   " }), false);
check("ID de elenco, que é o que a AD lê na tira", numeros({ ...FILTRO_VAZIO, busca: "AKE" }), ["12", "19 · Voice off"]);
check("ID de elenco em minúscula", numeros({ ...FILTRO_VAZIO, busca: "ben" }), ["7"]);

console.log("\n=== Parte herda da cena ===");
check("parte entra no filtro de elenco e locação pela cena", numeros({ ...FILTRO_VAZIO, locacaoIds: ["L2"], characterIds: ["akemi"], classesLuz: ["DIA"] }), ["19 · Voice off"]);

console.log(`\n${falhas === 0 ? "TUDO OK" : `FALHOU (${falhas})`}`);
process.exit(falhas === 0 ? 0 : 1);
