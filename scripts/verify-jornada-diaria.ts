/**
 * Modo simplificado da diária — orçamento de tempo: lista de horários, teto (jornada ou hora de fim)
 * e o aviso. Puro, sem banco.
 *
 *   npm run verify:jornada
 */
import { intercalar, scheduleDaTimeline, separarTimeline, type BlocoDeTempo } from "../src/lib/day-timeline";
import { avaliarJornada, jornadaDoTeto, mensagemJornada, montarJornada, type CenaDaJornada } from "../src/lib/jornada-diaria";
import { computeDerivedBlockTimes, minutesToTime, type JornadaConfig } from "../src/lib/schedule";
import { shootDayPlanejamentoSchema } from "../src/lib/validation/shoot-day";

let falhas = 0;
function check(nome: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) falhas++;
  console.log(`  ${ok ? "OK  " : "FORA"} ${nome}${ok ? "" : ` — veio ${JSON.stringify(got)}, esperado ${JSON.stringify(want)}`}`);
}

type Cena = CenaDaJornada & { numero: string };
const cena = (numero: string, ordem: number, prepMin: number, rodMin: number, bloco: "MANHA" | "TARDE" = "MANHA"): Cena => ({
  numero,
  ordem,
  bloco,
  prepMin,
  rodMin,
});
const bloco = (rotulo: string, ordem: number, duracaoMin: number, lado: "MANHA" | "TARDE" = "MANHA"): BlocoDeTempo => ({
  id: rotulo,
  rotulo,
  duracaoMin,
  ordem,
  bloco: lado,
});
const hhmm = (min: number | null) => (min === null ? null : minutesToTime(min));
const rotulos = (m: ReturnType<typeof montarJornada<Cena>>) =>
  m.linhas.map((l) =>
    `${hhmm(l.inicio)} ${l.kind === "cena" ? `Cena ${l.cena.numero}` : l.kind === "bloco" ? l.bloco.rotulo : l.kind}`
  );

const config: JornadaConfig = { preparacaoInicialMin: 30, duracaoAlmocoMin: 60, limiteAlmocoMin: 360 };

console.log("\n=== O exemplo da AD, linha a linha ===");
// Já dividida (manhã/tarde gravados), como fica depois do primeiro save.
const exemplo = {
  chamadaGeral: "07:00",
  config,
  cenas: [cena("18", 0, 30, 90), cena("21", 2, 60, 40), cena("25", 3, 20, 100, "TARDE"), cena("30", 4, 15, 120, "TARDE")],
  blocos: [bloco("Deslocamento", 1, 45)],
};
const m1 = montarJornada(exemplo);
check(
  "07h00 chamada 30min · 07h30 cena 18 · 09h30 deslocamento · 10h15 cena 21 · 11h55 almoço",
  rotulos(m1).slice(0, 5),
  ["07:00 chamada", "07:30 Cena 18", "09:30 Deslocamento", "10:15 Cena 21", "11:55 almoco"]
);
check("tarde começa no fim do almoço (12h55)", rotulos(m1)[5], "12:55 Cena 25");
check("desprodução no fim previsto", rotulos(m1).at(-1), "17:10 desprod");
check("total = da chamada à desprodução", m1.totalMin, 30 + 120 + 45 + 100 + 60 + 120 + 135);

console.log("\n=== Mesmos horários que o servidor grava e a OD imprime ===");
// recalculateDayBlocks: computeDerivedBlockTimes com os itens da manhã; OD: scheduleDaTimeline a
// partir de blocoManhaInicio / blocoTardeInicio. A lista simplificada tem que bater com os dois.
const manha = intercalar(exemplo.cenas.filter((c) => c.bloco === "MANHA"), exemplo.blocos.filter((b) => b.bloco === "MANHA"));
const tarde = intercalar(exemplo.cenas.filter((c) => c.bloco === "TARDE"), exemplo.blocos.filter((b) => b.bloco === "TARDE"));
const itemDe = (i: (typeof manha)[number]) => (i.tipo === "cena" ? i.cena : { prepMin: 0, rodMin: i.bloco.duracaoMin });
const derivado = computeDerivedBlockTimes("07:00", manha.map(itemDe), config);
const odManha = separarTimeline(manha, scheduleDaTimeline(derivado.blocoManhaInicio, manha, (c) => c));
const odTarde = separarTimeline(tarde, scheduleDaTimeline(derivado.blocoTardeInicio, tarde, (c) => c));
const odInicios = [...odManha.cenas, ...odTarde.cenas].map((c) => c.schedule!.prepStart);
const nossos = m1.linhas.flatMap((l) => (l.kind === "cena" ? [hhmm(l.inicio)] : []));
check("início de cada cena = prepStart da OD", nossos, odInicios);
check("almoço = almocoInicio gravado", hhmm(m1.linhas.find((l) => l.kind === "almoco")!.inicio), derivado.almocoInicio);
check("bloco de tempo = início que a OD imprime", hhmm(m1.linhas.find((l) => l.kind === "bloco")!.inicio), odManha.blocos[0].inicio);

console.log("\n=== Diária nunca dividida: corte sugerido, igual ao recalculateDayBlocks ===");
// Tudo MANHA; limite de almoço 6h depois da chamada (13h00). Cena C (rod até 13h30) passa do
// limite → almoço antes dela.
const nunca = montarJornada({
  chamadaGeral: "07:00",
  config,
  cenas: [cena("A", 0, 30, 120), cena("B", 1, 30, 120), cena("C", 2, 30, 60)],
  blocos: [],
});
check("almoço antes da cena que passaria do limite", rotulos(nunca), [
  "07:00 chamada",
  "07:30 Cena A",
  "10:00 Cena B",
  "12:30 almoco",
  "13:30 Cena C",
  "15:00 desprod",
]);

console.log("\n=== Bloco de tempo entra no fim previsto ===");
const semBloco = montarJornada({ ...exemplo, blocos: [] });
check("45min de deslocamento empurram o fim 45min", m1.fimMin! - semBloco.fimMin!, 45);

console.log("\n=== Teto: jornada ou hora de fim ===");
check("jornada 12h", jornadaDoTeto({ jornadaMin: 720, horaFimAlvo: null }, "07:00"), 720);
check("acaba às 18h com chamada 7h = 11h", jornadaDoTeto({ jornadaMin: null, horaFimAlvo: "18:00" }, "07:00"), 660);
check("noturna: chamada 18h, fim 6h = 12h", jornadaDoTeto({ jornadaMin: null, horaFimAlvo: "06:00" }, "18:00"), 720);
check("hora de fim sem chamada: não dá pra saber", jornadaDoTeto({ jornadaMin: null, horaFimAlvo: "18:00" }, null), null);

console.log("\n=== O aviso ===");
// 07h00 → 19h40 = 12h40; teto 12h → excedeu 40min.
const longa = montarJornada({
  chamadaGeral: "07:00",
  config,
  cenas: [cena("1", 0, 30, 240), cena("2", 1, 30, 150, "TARDE"), cena("3", 2, 30, 190, "TARDE")],
  blocos: [],
});
check("fim previsto 19h40", hhmm(longa.fimMin), "19:40");
const av12h = avaliarJornada({ jornadaMin: 720, horaFimAlvo: null }, "07:00", longa);
check("estourou", mensagemJornada(av12h, { cortaveisMin: 0 }), {
  tom: "estourou",
  linhas: [
    "Excedeu em 40min. Fim previsto 19h40, limite 19h00.",
    "Corte 40min de prep ou rodagem, ou empurre uma cena pra outra diária.",
  ],
});
check("estourou com planos cortáveis", mensagemJornada(av12h, { cortaveisMin: 110 })!.linhas.slice(0, 2), [
  "Excedeu em 40min. Fim previsto 19h40, limite 19h00.",
  "Há 1h50 em planos cortáveis.",
]);
const avFim20 = avaliarJornada({ jornadaMin: null, horaFimAlvo: "20:05" }, "07:00", longa);
check("coube", mensagemJornada(avFim20, { cortaveisMin: 110 }), { tom: "coube", linhas: ["Sobram 25min na jornada."] });
check("coube: cortáveis não aparecem", mensagemJornada(avFim20, { cortaveisMin: 110 })!.linhas.length, 1);
check("sem teto: nada", mensagemJornada(avaliarJornada({ jornadaMin: null, horaFimAlvo: null }, "07:00", longa), { cortaveisMin: 0 }), null);
check("fechou na conta exata: sobram 0min", mensagemJornada(avaliarJornada({ jornadaMin: 760, horaFimAlvo: null }, "07:00", longa), { cortaveisMin: 0 })!.linhas, ["Sobram 0min na jornada."]);

console.log("\n=== Sem chamada geral: só durações ===");
const semChamada = montarJornada({ ...exemplo, chamadaGeral: null });
check("nenhum horário", semChamada.linhas.every((l) => l.inicio === null), true);
check("total igual ao da diária com chamada", semChamada.totalMin, m1.totalMin);
check(
  "jornada ainda avisa, pela soma",
  mensagemJornada(avaliarJornada({ jornadaMin: 540, horaFimAlvo: null }, null, semChamada), { cortaveisMin: 0 })!.linhas[0],
  "Excedeu em 1h10. A diária soma 10h10 e a jornada é de 9h."
);
check(
  "hora de fim sem chamada pede a chamada",
  mensagemJornada(avaliarJornada({ jornadaMin: null, horaFimAlvo: "18:00" }, null, semChamada), { cortaveisMin: 0 }),
  { tom: "info", linhas: ["Defina a chamada geral pra comparar com o fim às 18h00."] }
);

console.log("\n=== Diária que vira a noite ===");
const noturna = montarJornada({ chamadaGeral: "18:00", config, cenas: [cena("N", 0, 30, 300), cena("M", 1, 30, 310, "TARDE")], blocos: [] });
const avNoite = avaliarJornada({ jornadaMin: null, horaFimAlvo: "06:00" }, "18:00", noturna);
check("fim previsto passa da meia-noite", mensagemJornada(avNoite, { cortaveisMin: 0 })!.linhas[0], "Excedeu em 40min. Fim previsto 6h40 (+1), limite 6h00 (+1).");

console.log("\n=== Diária vazia ===");
check("sem cena nem bloco: lista vazia, sem fim", [montarJornada({ ...exemplo, cenas: [], blocos: [] }).linhas.length, montarJornada({ ...exemplo, cenas: [], blocos: [] }).fimMin], [0, null]);

console.log("\n=== Validação do teto (rota da diária) ===");
const ok = (b: unknown) => shootDayPlanejamentoSchema.safeParse(b).success;
check("jornada sozinha", ok({ jornadaMin: 720 }), true);
check("hora de fim sozinha", ok({ horaFimAlvo: "18:00" }), true);
check("limpar os dois", ok({ jornadaMin: null, horaFimAlvo: null }), true);
check("os dois ao mesmo tempo: recusa", ok({ jornadaMin: 720, horaFimAlvo: "18:00" }), false);
check("jornada abaixo de 1h: recusa", ok({ jornadaMin: 30 }), false);
check("hora inválida: recusa", ok({ horaFimAlvo: "25:00" }), false);
check("modo sozinho", ok({ modoPlanejamento: "SIMPLIFICADO" }), true);
check("campo de outro formulário junto: recusa (strict)", ok({ jornadaMin: 720, chamadaGeral: "07:00" }), false);
check("payload vazio: recusa", ok({}), false);

console.log(`\n${falhas === 0 ? "TUDO OK" : `FALHOU (${falhas})`}`);
process.exit(falhas === 0 ? 0 : 1);
