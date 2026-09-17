/**
 * Timeline da diária com blocos de tempo livres (transporte, espera de luz...) — intercalação com as
 * cenas pela ordem compartilhada e horário do dia. Bloco não é cena: não tem prep, não conta oitavo.
 *
 *   npm run verify:timeline
 */
import { BLOCO_PRESETS, intercalar, minutosEmBlocos, scheduleDaTimeline, separarTimeline } from "../src/lib/day-timeline";

let falhas = 0;
function check(nome: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) falhas++;
  console.log(`  ${ok ? "OK  " : "FORA"} ${nome}${ok ? "" : ` — veio ${JSON.stringify(got)}, esperado ${JSON.stringify(want)}`}`);
}

const cena = (numero: string, ordem: number, prepMin: number, rodMin: number) => ({ numero, ordem, prepMin, rodMin });
const bloco = (rotulo: string, ordem: number, duracaoMin: number) => ({ id: rotulo, rotulo, duracaoMin, ordem, bloco: "MANHA" as const });

console.log("\n=== Intercalar pela ordem ===");
const cenas = [cena("3", 0, 15, 60), cena("7", 2, 0, 30)];
const transporte = bloco("Transporte", 1, 70);
const itens = intercalar(cenas, [transporte]);
check("cena, bloco, cena", itens.map((i) => (i.tipo === "cena" ? i.cena.numero : i.bloco.rotulo)), ["3", "Transporte", "7"]);
check("sem blocos: só as cenas, na ordem", intercalar(cenas, []).map((i) => i.tipo), ["cena", "cena"]);
check("dia só com bloco", intercalar([], [transporte]).map((i) => i.tipo), ["bloco"]);

console.log("\n=== Horário ===");
const schedule = scheduleDaTimeline("08:00", itens, (c) => ({ prepMin: c.prepMin, rodMin: c.rodMin }));
const { cenas: comHorario, blocos } = separarTimeline(itens, schedule);
check("cena 3: prep 8h00-8h15, rod até 9h15", [comHorario[0].schedule!.prepStart, comHorario[0].schedule!.rodEnd], ["08:00", "09:15"]);
check("transporte sem prep: 9h15 às 10h25 (70min)", [blocos[0].inicio, blocos[0].fim], ["09:15", "10:25"]);
check("cena 7 empurrada pelo transporte: começa 10h25", comHorario[1].schedule!.rodStart, "10:25");
check("sem horário de início: nada calculado", separarTimeline(itens, scheduleDaTimeline(null, itens, () => ({ prepMin: 0, rodMin: 1 }))).blocos[0].inicio, null);
check("minutos em blocos somam só os blocos", minutosEmBlocos([transporte, bloco("Espera de luz", 5, 20)]), 90);

console.log("\n=== Presets ===");
check("cinco presets pedidos", BLOCO_PRESETS.map((p) => p.rotulo), ["Transporte", "Mudança de locação", "Espera de luz", "Maquiagem", "Refeição"]);
check("rótulos dos presets cabem em 30", BLOCO_PRESETS.every((p) => p.rotulo.length <= 30), true);

console.log(`\n${falhas === 0 ? "TUDO OK" : `FALHOU (${falhas})`}`);
process.exit(falhas === 0 ? 0 : 1);
