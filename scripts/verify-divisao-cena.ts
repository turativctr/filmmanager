/**
 * Divisão da mesma cena entre diárias (ScenePart) — regras puras. O ponto que não pode dar errado é
 * o dos oitavos: a soma das partes é igual aos oitavos da cena, nunca mais (senão o total do projeto
 * infla e o progresso mente).
 *
 *   npm run verify:divisao
 */
import {
  cenaConcluida,
  divisaoNaoFecha,
  formatOitavos,
  mensagemDivisaoNaoFecha,
  minutosEmPlanosSemParte,
  numeroComParte,
  origemRodDaParte,
  paginasDaEntrada,
  paginasParaOitavos,
  planosDaParte,
  resolveRodDaParte,
  tempoEstimadoDaEntrada,
  validarDivisao,
  vinculoDaParte,
} from "../src/lib/scene-parts-shared";

let falhas = 0;
function check(nome: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) falhas++;
  console.log(`  ${ok ? "OK  " : "FORA"} ${nome}${ok ? "" : ` — veio ${JSON.stringify(got)}, esperado ${JSON.stringify(want)}`}`);
}
const tipos = (p: ReturnType<typeof validarDivisao>) => p.map((x) => x.tipo);

console.log("\n=== Oitavos não duplicam ===");
const seisOitavos = paginasParaOitavos("0.750");
check("Scene.paginas 0.750 = 6 oitavos", seisOitavos, 6);
check("6/8 → 5/8 + 1/8 fecha", tipos(validarDivisao(6, [{ rotulo: "Imagem", oitavos: 5 }, { rotulo: "Voice off", oitavos: 1 }])), []);
check("6/8 → 3/8 + 3/8 fecha", tipos(validarDivisao(6, [{ rotulo: "Imagem", oitavos: 3 }, { rotulo: "Continuação", oitavos: 3 }])), []);
check("6/8 → 6/8 + 6/8 barrado", tipos(validarDivisao(6, [{ rotulo: "Imagem", oitavos: 6 }, { rotulo: "Voice off", oitavos: 6 }])), ["SOMA_NAO_FECHA"]);
check("parte de 0 oitavos (som puro) vale, se a soma fecha", tipos(validarDivisao(6, [{ rotulo: "Imagem", oitavos: 6 }, { rotulo: "Voice off", oitavos: 0 }])), []);
check("soma menor que a cena também barra", tipos(validarDivisao(6, [{ rotulo: "Imagem", oitavos: 4 }, { rotulo: "Voice off", oitavos: 1 }])), ["SOMA_NAO_FECHA"]);
check("uma parte só não é divisão", tipos(validarDivisao(6, [{ rotulo: "Imagem", oitavos: 6 }])), ["POUCAS_PARTES"]);
check("rótulo vazio barra", tipos(validarDivisao(6, [{ rotulo: " ", oitavos: 3 }, { rotulo: "B", oitavos: 3 }])), ["ROTULO_VAZIO"]);
check("oitavo negativo barra", tipos(validarDivisao(6, [{ rotulo: "A", oitavos: 7 }, { rotulo: "B", oitavos: -1 }])), ["OITAVOS_INVALIDOS"]);
check("oitavo fracionado barra", tipos(validarDivisao(6, [{ rotulo: "A", oitavos: 5.5 }, { rotulo: "B", oitavos: 0.5 }])), ["OITAVOS_INVALIDOS", "OITAVOS_INVALIDOS"]);

const partes = [
  { id: "img", rotulo: "Imagem", oitavos: 5 },
  { id: "vo", rotulo: "Voice off", oitavos: 1 },
];
const somaPaginas = partes.reduce((s, p) => s + paginasDaEntrada(0.75, p), 0);
check("páginas das partes somam as da cena (total do projeto não infla)", somaPaginas, 0.75);
check("cena sem divisão conta a página inteira", paginasDaEntrada(0.75, null), 0.75);

console.log("\n=== Divisão que deixa de fechar (páginas editadas depois) ===");
check("fecha", divisaoNaoFecha(6, partes), false);
check("cena foi para 1 página: não fecha", divisaoNaoFecha(8, partes), true);
check("mensagem", mensagemDivisaoNaoFecha(8, partes), "Divisão não fecha: as partes somam 6/8 e a cena tem 1. Ajuste os oitavos das partes.");
check("cena sem divisão sempre fecha", divisaoNaoFecha(8, []), false);
check("formato de oitavos", [formatOitavos(0), formatOitavos(6), formatOitavos(8), formatOitavos(10)], ["0", "6/8", "1", "1 2/8"]);

console.log("\n=== Rótulo e vínculo ===");
check("OD/Modo Set nunca só o número", numeroComParte("19", { rotulo: "Voice off" }), "19 · Voice off");
check("cena inteira fica igual", numeroComParte("19", null), "19");
check(
  "na diária da imagem",
  vinculoDaParte("19", { rotulo: "Imagem" }, [{ rotulo: "Voice off", numeroDia: 5 }]),
  "Cena 19 · Imagem · voice off na diária 5"
);
check(
  "na diária do voice off",
  vinculoDaParte("19", { rotulo: "Voice off" }, [{ rotulo: "Imagem", numeroDia: 2 }]),
  "Cena 19 · Voice off · imagem na diária 2"
);
check(
  "outra parte ainda sem diária",
  vinculoDaParte("19", { rotulo: "Imagem" }, [{ rotulo: "Voice off", numeroDia: null }]),
  "Cena 19 · Imagem · voice off sem diária"
);

console.log("\n=== Rod da parte ===");
const plano = (scenePartId: string | null, tempoTotalMin: number, status: "PENDENTE" | "DESCARTADO" = "PENDENTE") => ({
  tempoTotalMin,
  tempoResetMin: 0,
  tempoResetMinManual: null,
  takesPrevistos: 3,
  status,
  scenePartId,
});
const planos = [plano("img", 20), plano("img", 10), plano(null, 7), plano("img", 99, "DESCARTADO")];
const base = { oitavosCena: 6, tempoEstimadoCenaMin: 30, planos };
check("soma só dos planos atribuídos (sem o sem-parte, sem descartado)", resolveRodDaParte({ ...base, parteId: "img", oitavosParte: 5 }), { rodMin: 30, fonte: "PLANOS" });
check("parte sem planos: estimado proporcional aos oitavos", resolveRodDaParte({ ...base, parteId: "img2", oitavosParte: 3 }), { rodMin: 15, fonte: "ESTIMADO_PROPORCIONAL" });
check("voice off de 0 oitavos cai no mínimo, marcado como mínimo", resolveRodDaParte({ ...base, parteId: "vo", oitavosParte: 0 }), { rodMin: 5, fonte: "MINIMO" });
check("proporcional abaixo do mínimo também é mínimo", resolveRodDaParte({ ...base, tempoEstimadoCenaMin: 12, parteId: "x", oitavosParte: 1 }), { rodMin: 5, fonte: "MINIMO" });
check("rótulo do mínimo diz que é chute", origemRodDaParte("MINIMO"), "mínimo, sem planos e sem páginas — defina");
check("plano sem parte vira aviso, não Rod", minutosEmPlanosSemParte(planos), 7);
check("plano sem parte aparece em todas as partes", planosDaParte(planos, "vo").map((p) => p.tempoTotalMin), [7]);
check("parte vê os seus + os sem parte", planosDaParte(planos, "img").map((p) => p.tempoTotalMin), [20, 10, 7, 99]);
check("estimado da entrada: 1/8 de 30min em 6/8", tempoEstimadoDaEntrada(30, 6, { oitavos: 1 }), 5);
check("estimado da entrada sem parte = da cena", tempoEstimadoDaEntrada(30, 6, null), 30);

console.log("\n=== Progresso ===");
check("dividida: uma parte concluída não conclui a cena", cenaConcluida(2, ["CONCLUIDA", "PENDENTE"]), false);
check("dividida: parte sem diária conta como não concluída", cenaConcluida(2, ["CONCLUIDA"]), false);
check("dividida: todas concluídas", cenaConcluida(2, ["CONCLUIDA", "CONCLUIDA"]), true);
check("inteira concluída", cenaConcluida(0, ["CONCLUIDA"]), true);

console.log(`\n${falhas === 0 ? "TUDO OK" : `FALHOU (${falhas})`}`);
process.exit(falhas === 0 ? 0 : 1);
