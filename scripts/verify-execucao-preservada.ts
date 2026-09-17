/**
 * Registro de execução da cena na diária (status, hora de início real, hora de fim real) não é
 * planejamento: reordenar o dia ou salvar a Ordem do Dia não pode reescrever. Só mudar de diária
 * zera, porque a execução pertence à diária em que aconteceu.
 *
 *   npm run verify:execucao
 */
import {
  CAMPOS_DE_EXECUCAO,
  CAMPOS_DE_PLANEJAMENTO,
  dadosDaReordenacao,
  temExecucao,
} from "../src/lib/scene-shoot-day-fields";

let falhas = 0;
function check(nome: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) falhas++;
  console.log(`  ${ok ? "OK  " : "FORA"} ${nome}${ok ? "" : ` — veio ${JSON.stringify(got)}, esperado ${JSON.stringify(want)}`}`);
}

const filmada = {
  shootDayId: "d3",
  ordem: 0,
  bloco: "MANHA" as const,
  prepMin: 90,
  rodMin: 90,
  status: "CONCLUIDA" as const,
  horaInicioReal: "10:15",
  horaFimReal: "11:30",
};

console.log("\n=== Reordenar na mesma diária ===");
const mesmoDia = dadosDaReordenacao(filmada, { shootDayId: "d3", ordem: 4, bloco: "TARDE", prepMin: 15, rodMin: 60 });
check("planejamento é reescrito", [mesmoDia.ordem, mesmoDia.bloco, mesmoDia.prepMin, mesmoDia.rodMin], [4, "TARDE", 15, 60]);
check("execução não é tocada (nada de status/horas no update)", CAMPOS_DE_EXECUCAO.map((c) => c in mesmoDia), [false, false, false]);

console.log("\n=== Mudar de diária ===");
const outroDia = dadosDaReordenacao(filmada, { shootDayId: "d5", ordem: 0, bloco: "MANHA", prepMin: 15, rodMin: 60 });
check("execução recomeça na diária nova", [outroDia.status, outroDia.horaInicioReal, outroDia.horaFimReal], ["PENDENTE", null, null]);
check("planejamento vai junto", [outroDia.shootDayId, outroDia.ordem], ["d5", 0]);

console.log("\n=== Classificação dos campos ===");
check("execução", [...CAMPOS_DE_EXECUCAO], ["status", "horaInicioReal", "horaFimReal"]);
check("planejamento", [...CAMPOS_DE_PLANEJAMENTO], ["ordem", "bloco", "prepMin", "rodMin"]);
check("nenhum campo nos dois grupos", CAMPOS_DE_PLANEJAMENTO.some((c) => (CAMPOS_DE_EXECUCAO as readonly string[]).includes(c)), false);

console.log("\n=== Quando a tela precisa avisar ===");
check("cena concluída", temExecucao(filmada), true);
check("em andamento, sem horas ainda", temExecucao({ status: "EM_ANDAMENTO", horaInicioReal: null, horaFimReal: null }), true);
check("pendente com hora de início (começou a rodar)", temExecucao({ status: "PENDENTE", horaInicioReal: "10:15", horaFimReal: null }), true);
check("pendente e sem horas: nada a perder", temExecucao({ status: "PENDENTE", horaInicioReal: null, horaFimReal: null }), false);

console.log(`\n${falhas === 0 ? "TUDO OK" : `FALHOU (${falhas})`}`);
process.exit(falhas === 0 ? 0 : 1);
