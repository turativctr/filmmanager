/**
 * Estimativa com origem visível: os três estágios (digitado, realizado deste projeto, ponto de
 * partida da produção), os rótulos e a média do projeto. Puro, sem banco.
 *
 *   npm run verify:estimativa
 */
import {
  ACRESCIMO_EXTERIOR_PADRAO,
  avisoDigitadoVsPlanos,
  calcularMediaDoProjeto,
  CONVENCAO_MIN_POR_OITAVO,
  MIN_POR_OITAVO_PADRAO,
  notaDoTotal,
  PARTIDA_PADRAO,
  resolverOrigemDoTempo,
  rotuloOrigem,
  rotuloOrigemCurto,
  tempoDePartidaMin,
  tempoDeReferenciaMin,
  textoComOrigem,
  textoDaPartida,
  type EntradaDaEstimativa,
  type PartidaDoProjeto,
} from "../src/lib/estimativa";

let falhas = 0;
function check(nome: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) falhas++;
  console.log(`  ${ok ? "OK  " : "FORA"} ${nome}${ok ? "" : ` — veio ${JSON.stringify(got)}, esperado ${JSON.stringify(want)}`}`);
}

const partida = PARTIDA_PADRAO;
/** Atalho: quase todo caso é "estimativa pra montar horário" (permitirPartida true). */
const resolver = (e: Omit<EntradaDaEstimativa, "partida" | "permitirPartida"> & Partial<Pick<EntradaDaEstimativa, "partida" | "permitirPartida">>) =>
  resolverOrigemDoTempo({ partida, permitirPartida: true, ...e });

console.log("\n=== Estágio 1: o que a AD digitou manda ===");
check("digitado ganha dos planos", resolver({ digitadoMin: 40, planosMin: 52, planos: 4, oitavos: 6 }), {
  kind: "DIGITADO",
  min: 40,
});
check("rótulo", textoComOrigem({ kind: "DIGITADO", min: 40 }), "40min (você definiu)");
check(
  "aviso quando a decupagem discorda — e nada é sobrescrito",
  avisoDigitadoVsPlanos(40, 52),
  "os planos somam 52min, você definiu 40min"
);
check("sem divergência, sem aviso", avisoDigitadoVsPlanos(40, 40), null);
check("duração alvo vem antes dos planos", resolver({ duracaoAlvoMin: 30, planosMin: 52, planos: 4, oitavos: 6 }).kind, "DURACAO_ALVO");

console.log("\n=== Planos: o rótulo nomeia os resets e o ritmo do dia ===");
check(
  "planos + resets",
  textoComOrigem(resolver({ planosMin: 75, planos: 6, resetsMin: 25, oitavos: 6 })),
  "1h15 (6 planos + 25min de resets)"
);
check(
  "ritmo da diária diferente de 100% aparece",
  textoComOrigem(resolver({ planosMin: 75, planos: 6, resetsMin: 25, fatorResetPercent: 120, oitavos: 6 })),
  "1h15 (6 planos + 25min de resets · com ritmo de 120%)"
);
check(
  "sem reset nenhum, não inventa a frase",
  textoComOrigem(resolver({ planosMin: 52, planos: 4, resetsMin: 0, oitavos: 6 })),
  "52min (4 planos)"
);
check("um plano só, no singular", rotuloOrigem(resolver({ planosMin: 12, planos: 1, oitavos: 2 })), "1 plano");

console.log("\n=== Rod já gravado manda sobre estimativa (é ele que vira horário) ===");
check("gravado sem marca de digitado", resolver({ gravadoMin: 30, oitavos: 4 }), { kind: "LEGADO", min: 30 });
check("rótulo", textoComOrigem({ kind: "LEGADO", min: 30 }), "30min (gravado antes desta versão — confira)");
check("planos ganham do gravado: a decupagem é da AD", resolver({ gravadoMin: 30, planosMin: 52, planos: 4, oitavos: 4 }).kind, "PLANOS");

console.log("\n=== Estágio 2: média DESTE projeto ===");
const filmadas = [
  { shootDayId: "d1", realizadoMin: 120, oitavos: 6, planos: 5 },
  { shootDayId: "d1", realizadoMin: 90, oitavos: 4, planos: 4 },
  { shootDayId: "d2", realizadoMin: 150, oitavos: 8, planos: 6 },
];
check("uma diária só: média não existe", calcularMediaDoProjeto(filmadas.slice(0, 2)), {
  diarias: 1,
  minPorPlano: null,
  minPorOitavo: null,
});
const media = calcularMediaDoProjeto(filmadas);
check("duas diárias ligam a média", [media.diarias, media.minPorPlano, media.minPorOitavo], [2, 24, 20]);
check("cena com planos usa a média por plano", resolver({ planos: 3, oitavos: 4, media }), {
  kind: "MEDIA_PROJETO",
  min: 72,
  base: "PLANO",
  diarias: 2,
});
check("cena sem planos usa a média por oitavo", resolver({ planos: 0, oitavos: 4, media }), {
  kind: "MEDIA_PROJETO",
  min: 80,
  base: "OITAVO",
  diarias: 2,
});
check("a média ganha do ponto de partida", resolver({ oitavos: 4, media }).kind, "MEDIA_PROJETO");

console.log("\n=== Estágio 3: ponto de partida DA PRODUÇÃO (não mais convenção de mercado) ===");
check("padrão começa na praxe de mercado", [MIN_POR_OITAVO_PADRAO, CONVENCAO_MIN_POR_OITAVO], [5, 5]);
check("interior: oitavos × minuto do projeto", tempoDePartidaMin(6, "INT", partida), 30);
check("exterior soma o acréscimo", tempoDePartidaMin(6, "EXT", partida), 36);
check("INT/EXT indefinido não paga acréscimo", tempoDePartidaMin(6, null, partida), 30);
check("sem páginas não há partida", tempoDePartidaMin(0, "EXT", partida), null);
check(
  "rótulo diz que o número é do projeto",
  textoComOrigem(resolver({ oitavos: 6, ambiente: "INT" })),
  "30min (ponto de partida do projeto: 5min por oitavo)"
);
check(
  "e diz o acréscimo quando é exterior",
  textoComOrigem(resolver({ oitavos: 6, ambiente: "EXT" })),
  "36min (ponto de partida do projeto: 5min por oitavo · +20% em exterior)"
);
const daProducao: PartidaDoProjeto = { minPorOitavo: 9, acrescimoExteriorPercent: 35 };
check(
  "número editado pela produção é o que aparece",
  textoComOrigem(resolverOrigemDoTempo({ oitavos: 4, ambiente: "EXT", partida: daProducao, permitirPartida: true })),
  "49min (ponto de partida do projeto: 9min por oitavo · +35% em exterior)"
);
check("acréscimo zerado some da frase", textoDaPartida({ minPorOitavo: 7, acrescimoExteriorPercent: 0 }, "EXT"), "ponto de partida do projeto: 7min por oitavo");
check("padrão do acréscimo", ACRESCIMO_EXTERIOR_PADRAO, 20);

console.log("\n=== 'Sem base pra estimar' agora chega na tela ===");
check(
  "onde não precisa de horário, diz que não há base — e mostra de onde sairia",
  textoComOrigem(resolverOrigemDoTempo({ oitavos: 6, ambiente: "EXT", partida, permitirPartida: false })),
  "sem base pra estimar — ponto de partida do projeto: 5min por oitavo · +20% em exterior"
);
check(
  "cena sem páginas: sem base e sem orientação",
  textoComOrigem(resolverOrigemDoTempo({ oitavos: 0, partida, permitirPartida: true })),
  "sem base pra estimar"
);
check(
  "permitirPartida não tem default: quem chama decide",
  // @ts-expect-error a ausência do campo é erro de tipo — é isso que impede o default silencioso voltar
  (() => { try { return resolverOrigemDoTempo({ oitavos: 6, partida }).kind; } catch { return "erro"; } })(),
  "SEM_BASE"
);

console.log("\n=== Tempo de referência do cronograma ===");
check("cena com tempo próprio", tempoDeReferenciaMin(45, 6, partida, "EXT"), 45);
check("cena importada cai na partida do projeto", tempoDeReferenciaMin(null, 6, partida, "INT"), 30);
check("exterior importada leva o acréscimo", tempoDeReferenciaMin(null, 6, partida, "EXT"), 36);
check("sem páginas, nem partida", tempoDeReferenciaMin(null, 0, partida, "INT"), null);

console.log("\n=== Totais e documentos ===");
check(
  "soma com ponto de partida avisa",
  notaDoTotal([{ kind: "DIGITADO", min: 40 }, { kind: "PARTIDA", min: 30, partida, ambiente: "INT" }]),
  "inclui ponto de partida do projeto"
);
check("soma toda definida não avisa nada", notaDoTotal([{ kind: "DIGITADO", min: 40 }]), null);
check(
  "formas curtas pra coluna de PDF",
  [
    rotuloOrigemCurto({ kind: "DIGITADO", min: 1 }),
    rotuloOrigemCurto({ kind: "PLANOS", min: 1, planos: 1, resetsMin: 0, fatorResetPercent: 100 }),
    rotuloOrigemCurto({ kind: "MEDIA_PROJETO", min: 1, base: "PLANO", diarias: 2 }),
    rotuloOrigemCurto({ kind: "PARTIDA", min: 1, partida, ambiente: null }),
    rotuloOrigemCurto({ kind: "LEGADO", min: 1 }),
    rotuloOrigemCurto({ kind: "SEM_BASE", min: null, orientacao: null }),
  ],
  ["def.", "planos", "média", "partida", "gravado", "—"]
);

console.log(`\n${falhas === 0 ? "TUDO OK" : `FALHOU (${falhas})`}`);
process.exit(falhas === 0 ? 0 : 1);
