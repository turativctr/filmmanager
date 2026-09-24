/**
 * Estimativa com origem visível: os três estágios (digitado, realizado deste projeto, ponto de
 * partida), os rótulos e a média do projeto. Puro, sem banco.
 *
 *   npm run verify:estimativa
 */
import {
  avisoDigitadoVsPlanos,
  calcularMediaDoProjeto,
  CONVENCAO_MIN_POR_OITAVO,
  FAIXAS_PADRAO,
  lerFaixas,
  notaDoTotal,
  resolverOrigemDoTempo,
  rotuloOrigem,
  rotuloOrigemCurto,
  tempoDeReferenciaMin,
  textoComOrigem,
  textoDeOrientacao,
} from "../src/lib/estimativa";

let falhas = 0;
function check(nome: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) falhas++;
  console.log(`  ${ok ? "OK  " : "FORA"} ${nome}${ok ? "" : ` — veio ${JSON.stringify(got)}, esperado ${JSON.stringify(want)}`}`);
}

const faixas = FAIXAS_PADRAO;

console.log("\n=== Estágio 1: o que a AD digitou manda ===");
check(
  "digitado ganha dos planos",
  resolverOrigemDoTempo({ digitadoMin: 40, planosMin: 52, planos: 4, oitavos: 6 }),
  { kind: "DIGITADO", min: 40 }
);
check("rótulo", textoComOrigem({ kind: "DIGITADO", min: 40 }), "40min (você definiu)");
check(
  "aviso quando a decupagem discorda — e nada é sobrescrito",
  avisoDigitadoVsPlanos(40, 52),
  "os planos somam 52min, você definiu 40min"
);
check("sem divergência, sem aviso", avisoDigitadoVsPlanos(40, 40), null);
check(
  "duração alvo vem antes dos planos",
  resolverOrigemDoTempo({ duracaoAlvoMin: 30, planosMin: 52, planos: 4, oitavos: 6 }).kind,
  "DURACAO_ALVO"
);
check(
  "decupagem da AD antes de qualquer estimativa",
  textoComOrigem(resolverOrigemDoTempo({ planosMin: 52, planos: 4, oitavos: 6 })),
  "52min (soma de 4 planos)"
);

console.log("\n=== Rod já gravado na diária manda sobre estimativa (é ele que vira horário) ===");
check(
  "gravado sem marca de digitado aparece com aviso de origem perdida",
  resolverOrigemDoTempo({ gravadoMin: 30, oitavos: 4, permitirConvencao: true }),
  { kind: "LEGADO", min: 30 }
);
check(
  "rótulo",
  textoComOrigem({ kind: "LEGADO", min: 30 }),
  "30min (gravado antes desta versão — confira)"
);
check(
  "planos ganham do gravado: a decupagem é da AD",
  resolverOrigemDoTempo({ gravadoMin: 30, planosMin: 52, planos: 4, oitavos: 4 }).kind,
  "PLANOS"
);
check(
  "sem nada gravado, a estimativa segue os estágios",
  resolverOrigemDoTempo({ gravadoMin: null, oitavos: 4, permitirConvencao: true }).kind,
  "CONVENCAO"
);

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
check(
  "cena com planos usa a média por plano",
  resolverOrigemDoTempo({ planos: 3, oitavos: 4, media }),
  { kind: "MEDIA_PROJETO", min: 72, base: "PLANO", diarias: 2 }
);
check(
  "cena sem planos usa a média por oitavo",
  resolverOrigemDoTempo({ planos: 0, oitavos: 4, media }),
  { kind: "MEDIA_PROJETO", min: 80, base: "OITAVO", diarias: 2 }
);
check(
  "rótulo por plano",
  rotuloOrigem({ kind: "MEDIA_PROJETO", min: 22, base: "PLANO", diarias: 3 }),
  "média deste projeto, 3 diárias"
);
check(
  "rótulo por oitavo diz que é por oitavo",
  rotuloOrigem({ kind: "MEDIA_PROJETO", min: 80, base: "OITAVO", diarias: 2 }),
  "média deste projeto, 2 diárias, por oitavo"
);
check(
  "média nunca se mistura com previsto: só entra cena lançada (quem chama filtra)",
  calcularMediaDoProjeto([]).diarias,
  0
);

console.log("\n=== Estágio 3: ponto de partida, nunca número ===");
check(
  "sem planos, sem média e sem convenção: sem base, com orientação",
  resolverOrigemDoTempo({ oitavos: 6, classificacao: "COM_MOVIMENTO", faixas, permitirConvencao: false }),
  {
    kind: "SEM_BASE",
    min: null,
    orientacao: "ponto de partida: 15 a 25min por plano · 8 a 14min por oitavo",
  }
);
check(
  "texto da tela",
  textoComOrigem(resolverOrigemDoTempo({ oitavos: 6, classificacao: "DIALOGO_ESTATICO", faixas, permitirConvencao: false })),
  "sem base pra estimar — ponto de partida: 8 a 12min por plano · 4 a 7min por oitavo"
);
check(
  "cena não classificada: sem base e sem orientação",
  textoComOrigem(resolverOrigemDoTempo({ oitavos: 6, classificacao: "NAO_CLASSIFICADO", faixas, permitirConvencao: false })),
  "sem base pra estimar"
);
check("não classificado não tem faixa", textoDeOrientacao("NAO_CLASSIFICADO", faixas), null);
check(
  "faixa por oitavo existe pra primeira OD, onde não há plano nenhum",
  textoDeOrientacao("EXTERIOR", faixas),
  "ponto de partida: 20 a 30min por plano · 10 a 18min por oitavo"
);

console.log("\n=== A convenção: só onde precisa existir horário, e sempre rotulada ===");
check(
  "cronograma usa a convenção",
  resolverOrigemDoTempo({ oitavos: 6, permitirConvencao: true }),
  { kind: "CONVENCAO", min: 30 }
);
check(
  "e diz o que é",
  textoComOrigem({ kind: "CONVENCAO", min: 30 }),
  `30min (convenção: ${CONVENCAO_MIN_POR_OITAVO}min por oitavo)`
);
check("cena sem páginas não tem nem convenção", resolverOrigemDoTempo({ oitavos: 0, permitirConvencao: true }).kind, "SEM_BASE");
check("tempo de referência: cena com tempo próprio", tempoDeReferenciaMin(45, 6), 45);
check("tempo de referência: cena importada cai na convenção", tempoDeReferenciaMin(null, 6), 30);
check("sem páginas, nem convenção", tempoDeReferenciaMin(null, 0), null);

console.log("\n=== Totais e documentos ===");
check(
  "soma com convenção avisa",
  notaDoTotal([{ kind: "DIGITADO", min: 40 }, { kind: "CONVENCAO", min: 30 }]),
  "inclui tempo de convenção (5min por oitavo)"
);
check("soma toda definida não avisa nada", notaDoTotal([{ kind: "DIGITADO", min: 40 }]), null);
check("forma curta pra coluna de PDF", ["DIGITADO", "PLANOS", "MEDIA_PROJETO", "CONVENCAO", "SEM_BASE"].map((k) =>
  rotuloOrigemCurto(
    k === "PLANOS"
      ? { kind: "PLANOS", min: 1, planos: 1 }
      : k === "MEDIA_PROJETO"
        ? { kind: "MEDIA_PROJETO", min: 1, base: "PLANO", diarias: 2 }
        : k === "SEM_BASE"
          ? { kind: "SEM_BASE", min: null, orientacao: null }
          : ({ kind: k, min: 1 } as never)
  )
), ["def.", "planos", "média", "conv.", "—"]);

console.log("\n=== Faixas da produção (Project.faixasTempo) ===");
check("sem nada gravado: padrão", lerFaixas(null), FAIXAS_PADRAO);
check("lixo gravado: padrão, sem derrubar a tela", lerFaixas({ DIALOGO_ESTATICO: "qualquer coisa" }), FAIXAS_PADRAO);
check(
  "a produção reescreve uma classe e as outras seguem o padrão",
  lerFaixas({ EXTERIOR: { porPlano: { min: 30, max: 45 }, porOitavo: { min: 12, max: 20 } } }).EXTERIOR,
  { porPlano: { min: 30, max: 45 }, porOitavo: { min: 12, max: 20 } }
);
check(
  "faixa invertida é recusada (cai no padrão)",
  lerFaixas({ EXTERIOR: { porPlano: { min: 40, max: 10 }, porOitavo: { min: 12, max: 20 } } }).EXTERIOR,
  FAIXAS_PADRAO.EXTERIOR
);
check(
  "orientação usa a faixa da produção, não a do app",
  textoDeOrientacao("EXTERIOR", lerFaixas({ EXTERIOR: { porPlano: { min: 30, max: 45 }, porOitavo: { min: 12, max: 20 } } })),
  "ponto de partida: 30 a 45min por plano · 12 a 20min por oitavo"
);

console.log(`\n${falhas === 0 ? "TUDO OK" : `FALHOU (${falhas})`}`);
process.exit(falhas === 0 ? 0 : 1);
