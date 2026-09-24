/**
 * Lançamento do realizado: leitura da hora digitada, duração, status implicado e a comparação
 * planejado × realizado. Puro, sem banco.
 *
 *   npm run verify:realizado
 */
import {
  compararLinha,
  duracaoRealizadaMin,
  faixaHoraria,
  formatDesvio,
  fraseComparacao,
  fraseTotalDoDia,
  horasDoLancamento,
  parseHoraDigitada,
  statusDoLancamento,
  totalDoDia,
} from "../src/lib/realizado";

let falhas = 0;
function check(nome: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) falhas++;
  console.log(`  ${ok ? "OK  " : "FORA"} ${nome}${ok ? "" : ` — veio ${JSON.stringify(got)}, esperado ${JSON.stringify(want)}`}`);
}

console.log("\n=== Como a AD escreve hora no caderno ===");
check("11:00", parseHoraDigitada("11:00"), "11:00");
check("1100", parseHoraDigitada("1100"), "11:00");
check("11h00", parseHoraDigitada("11h00"), "11:00");
check("11h", parseHoraDigitada("11h"), "11:00");
check("9:05", parseHoraDigitada("9:05"), "09:05");
check("com espaço", parseHoraDigitada(" 7h30 "), "07:30");
check("vazio = apagar", parseHoraDigitada(""), null);
check("texto qualquer: recusa", parseHoraDigitada("cedo"), undefined);
check("25:00: recusa", parseHoraDigitada("25:00"), undefined);
check("11:70: recusa", parseHoraDigitada("11:70"), undefined);

console.log("\n=== Duração realizada ===");
check("11h00 às 13h50 = 2h50", duracaoRealizadaMin("11:00", "13:50"), 170);
check("diária que virou a noite: 22h às 03h = 5h", duracaoRealizadaMin("22:00", "03:00"), 300);
check("faltando o fim: não dá duração", duracaoRealizadaMin("11:00", null), null);
check("nada lançado", duracaoRealizadaMin(null, null), null);

console.log("\n=== Status que o lançamento implica ===");
check("as duas horas = concluída", statusDoLancamento({ horaInicioReal: "11:00", horaFimReal: "13:50" }), "CONCLUIDA");
check("só o início = em andamento", statusDoLancamento({ horaInicioReal: "11:00", horaFimReal: null }), "EM_ANDAMENTO");
check("em branco = pendente (lançamento desfeito)", statusDoLancamento({ horaInicioReal: null, horaFimReal: null }), "PENDENTE");
check(
  "não realizada = adiada, mesmo com hora digitada antes",
  statusDoLancamento({ horaInicioReal: "11:00", horaFimReal: "13:50", naoRealizada: true }),
  "ADIADA"
);
check(
  "não realizada não guarda horário",
  horasDoLancamento({ horaInicioReal: "11:00", horaFimReal: "13:50", naoRealizada: true }),
  { horaInicioReal: null, horaFimReal: null }
);
check("em branco fica em branco — nunca vira o previsto", horasDoLancamento({ horaInicioReal: null, horaFimReal: null }), {
  horaInicioReal: null,
  horaFimReal: null,
});

console.log("\n=== Comparação, com os números do pedido ===");
// Cena 18: previsto 11h00–13h50 (2h50), realizado 3h20.
const cena18 = compararLinha({ rotulo: "Cena 18", previstoMin: 170, horaInicioReal: "11:00", horaFimReal: "14:20" });
check("desvio da cena 18", cena18.desvioMin, 30);
check("frase da cena 18", fraseComparacao(cena18), "Cena 18 · previsto 2h50 · realizado 3h20 · +30min");
const cena21 = compararLinha({ rotulo: "Cena 21", previstoMin: 70, horaInicioReal: "14:50", horaFimReal: "16:05" });
const cena19 = compararLinha({ rotulo: "Cena 19", previstoMin: 90, horaInicioReal: "17:45", horaFimReal: "19:15" });
check("cena que fechou no previsto", fraseComparacao(cena19), "Cena 19 · previsto 1h30 · realizado 1h30 · no previsto");
check("cena adiantada", formatDesvio(cena21.desvioMin!), "+5min");
check("adiantou de verdade", formatDesvio(-25), "-25min");
check("sinal de menos é hífen comum (a Helvetica não tem −)", formatDesvio(-25).includes("−"), false);

console.log("\n=== Total do dia: só o que foi lançado ===");
const semLancar = compararLinha({ rotulo: "Cena 30", previstoMin: 120, horaInicioReal: null, horaFimReal: null });
const naoRealizada = compararLinha({
  rotulo: "Cena 31",
  previstoMin: 60,
  horaInicioReal: null,
  horaFimReal: null,
  naoRealizada: true,
});
const total = totalDoDia([cena18, cena21, cena19, semLancar, naoRealizada]);
check("três linhas entraram na conta", total.lancadas, 3);
check("previsto some só das lançadas", total.previstoMin, 170 + 70 + 90);
check("frase do dia", fraseTotalDoDia(total), "Diária · previsto 5h30 · realizado 6h05 · +35min");
check("cena não lançada não vira desvio", fraseComparacao(semLancar), "Cena 30 · sem realizado lançado");
check("cena não realizada aparece como tal", fraseComparacao(naoRealizada), "Cena 31 · não realizada");
check("dia sem nada lançado", fraseTotalDoDia(totalDoDia([semLancar])), "Diária · nenhum realizado lançado ainda");

console.log("\n=== Exemplo do pedido: previsto 8h20, realizado 9h05, +45min ===");
const doPedido = totalDoDia([
  compararLinha({ rotulo: "A", previstoMin: 500, horaInicioReal: "07:00", horaFimReal: "15:20" }),
  compararLinha({ rotulo: "B", previstoMin: 0, horaInicioReal: "15:20", horaFimReal: "16:05" }),
]);
check("total do dia", fraseTotalDoDia(doPedido), "Diária · previsto 8h20 · realizado 9h05 · +45min");

console.log("\n=== Faixa horária da coluna ===");
check("previsto completo", faixaHoraria("11:00", "13:50"), "11h00 às 13h50");
check("nada lançado", faixaHoraria(null, null), "—");
check("só o início", faixaHoraria("11:00", null), "11h00 às —");

console.log(`\n${falhas === 0 ? "TUDO OK" : `FALHOU (${falhas})`}`);
process.exit(falhas === 0 ? 0 : 1);
