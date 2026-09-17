/**
 * Gera TODOS os PDFs do projeto no pior caso de conteúdo e conta colisões de texto (célula
 * desenhada por cima da vizinha — ver scripts/lib/pdf-colisoes.ts). Pega a próxima coluna
 * dimensionada pelo caso médio antes de ela chegar na AD.
 *
 * Os dados vêm das mesmas funções que as rotas usam, lidos (só leitura) do projeto demo "Ressaca",
 * e depois são levados ao pior caso: período ENTARDECER, locação com 40+ caracteres, 6
 * personagens, sinopse de 200, descrição de plano de 150, números de 3 dígitos. Nada é gravado no
 * banco. Precisa do Postgres rodando e do seed do demo. Nos documentos por diária, toda cena vem
 * como parte de cena dividida ("102APL · " + rótulo de 30 caracteres).
 *
 * Também confere que nenhum caractere escrito no código dos PDFs fica fora da Helvetica (ver
 * scripts/lib/pdf-glifos.tsx).
 *
 *   npm run verify:pdf            (VERIFY_PDF_OUT=dir salva os PDFs gerados pra olhar)
 */
import { renderToBuffer } from "@react-pdf/renderer";
import type { ShotPrioridade, ShotTipoReset } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import type { ReactElement } from "react";

import type { BudgetData } from "../src/components/budget/types";
import {
  getActorSceneListData,
  getCastAccountingData,
  getCastScheduleData,
  getContinuityNotesReportData,
  getCrewContactListData,
  getDailyProgressReportData,
  getEscaletaData,
  getLocationSceneListData,
  getPlanoSimplesData,
  getWeeklyPlanData,
} from "../src/lib/ad-documents-data";
import { getBudgetData } from "../src/lib/budget-data";
import { getScriptDraftDetail } from "../src/lib/draft-report-data";
import { generateHoraAHoraEvents } from "../src/lib/hora-a-hora";
import { ActorSceneListDocument } from "../src/lib/pdf/actor-scene-list-document";
import { BreakdownDocument } from "../src/lib/pdf/breakdown-document";
import { BudgetComparisonDocument } from "../src/lib/pdf/budget-comparison-document";
import { BudgetDetailedDocument } from "../src/lib/pdf/budget-detailed-document";
import { CallSheetDocument } from "../src/lib/pdf/call-sheet-document";
import { CastAccountingDocument } from "../src/lib/pdf/cast-accounting-document";
import { CastScheduleDocument } from "../src/lib/pdf/cast-schedule-document";
import { ChangedPagesDocument } from "../src/lib/pdf/changed-pages-document";
import { ContinuismoDocument } from "../src/lib/pdf/continuismo-document";
import { ContinuityNotesDocument } from "../src/lib/pdf/continuity-notes-document";
import { CrewContactListDocument } from "../src/lib/pdf/crew-contact-list-document";
import { DailyProgressReportDocument } from "../src/lib/pdf/daily-progress-report-document";
import { EscaletaDocument } from "../src/lib/pdf/escaleta-document";
import { HHScheduleDocument } from "../src/lib/pdf/hh-schedule-document";
import { HoraAHoraDocument } from "../src/lib/pdf/hora-a-hora-document";
import { LocationSceneListDocument } from "../src/lib/pdf/location-scene-list-document";
import { PlanoDiariasDocument } from "../src/lib/pdf/plano-diarias-document";
import { ShotListDocument } from "../src/lib/pdf/shot-list-document";
import { TopsheetDocument } from "../src/lib/pdf/topsheet-document";
import { WeeklyPlanDocument } from "../src/lib/pdf/weekly-plan-document";
import { prisma } from "../src/lib/prisma";
import { getShootDayReportData, type ShootDayReportData, type ShotRow } from "../src/lib/report-data";
import { encontrarColisoes } from "./lib/pdf-colisoes";
import { encontrarGlifosQuebrados } from "./lib/pdf-glifos";

const PROJETO_DEMO = "Ressaca";

// ---------------------------------------------------------------------------
// Pior caso
// ---------------------------------------------------------------------------

/** Corta no tamanho exato — o pior caso é "200 caracteres", não "uns 200". */
function comTamanho(texto: string, n: number): string {
  if (texto.length < n) throw new Error(`Texto de pior caso com ${texto.length} caracteres, precisa de ${n}`);
  return texto.slice(0, n);
}

const PIOR = {
  periodo: "ENTARDECER", // a palavra mais larga dos períodos reconhecidos
  locacao: "Restaurante Bananeira — Salão Principal do Térreo", // 49
  endereco: "Rua Doutor Arnaldo de Figueiredo Albuquerque, 1234 — Sumaré, São Paulo/SP",
  sinopse: comTamanho(
    "Chef atravessa o salão lotado equilibrando três pratos enquanto a crítica gastronômica observa da mesa do canto; o garçom derruba a bandeja, a música para e todos se voltam para a porta da cozinha de novo",
    200
  ),
  descricaoPlano: comTamanho(
    "Travelling acompanhando Chef da porta da cozinha até a mesa da crítica, passando entre os garçons, fechando em close quando ela pousa o prato na mesa do canto",
    150
  ),
  personagem: "Maria Aparecida dos Santos Filha",
  ator: "Antônio Carlos Figueiredo Neto",
  sceneNumero: "102APL",
  // Cena dividida entre diárias: o rótulo da parte vai junto do número em todo documento por diária.
  // 30 é o máximo que a API aceita; palavras longas pra forçar quebra em coluna estreita.
  rotuloParte: comTamanho("Continuação do dublê voice off", 30),
  shotNumero: "12B",
  tresDigitos: 888, // dígitos têm a mesma largura em Helvetica; 888 é o pior caso de 3 dígitos
  paginas: 12.875, // "12 7/8"
  dinheiro: 9_999_999.99,
  ids: ["MARG", "WAGN", "HELO", "MAUR", "DOMI", "ROMU"],
};
if (PIOR.locacao.length < 40) throw new Error("Locação de pior caso precisa de 40+ caracteres");

const TEXTO_LONGO = new Set([
  "sinopse",
  "sinopseAD",
  "notasAD",
  "observacoes",
  "observacao",
  "observacoesGerais",
  "observacaoCronogramaElenco",
  "observacaoPlanoSimples",
  "motivoAtraso",
  "notasDirecao",
  "notasContinuidade",
  "texto",
  "notas",
  "motivo",
  "arteDressing",
  "notasArte",
  "notasFoto",
  "notasSom",
  "notasProducao",
  "meteoDescricao",
  "baseInfo",
  "estacionamento",
]);
const LOCACAO = new Set(["locacao", "locacaoNome", "local", "set", "setLocacaoDisplay", "nome", "setsDescricao", "hospitalNome"]);
const ENDERECO = new Set(["endereco", "locacaoEndereco", "hospitalEndereco", "transporteEndereco"]);
const TRES_DIGITOS = new Set([
  "takesPrevistos",
  "duracaoTakeMin",
  "tempoSetupMin",
  "tempoTotalMin",
  "tempoResetMin",
  "tempoEstimadoMin",
  "duracaoAlvoMin",
  "prepMin",
  "rodMin",
  "quantidade",
  "diasTrabalhados",
  "diasHold",
  "atrasoMin",
  "planosMin",
  "resetsMin",
  "totalMin",
  "count",
  "total",
  "cafe",
  "almoco",
]);
const DINHEIRO = new Set(["taxa", "valor", "base", "cacheeDiario"]);
const CAMPO_PLANO = {
  tamanho: "Primeiríssimo Plano",
  lente: "Anamórfica 135mm",
  angulo: "Contra-plongée",
  movimento: "Travelling lateral",
} as Record<string, string>;
const LISTA_BREAKDOWN = new Set([
  "figurino",
  "make",
  "objetos",
  "comidaCena",
  "microfones",
  "trilha",
  "habilidades",
  "arteGrafica",
  "posProducao",
]);

/** Leva um objeto de dados ao pior caso, campo por campo, pelo NOME do campo — o mesmo nome quer
 *  dizer a mesma coisa em todos os documentos. Só troca valor do mesmo tipo (período texto vira
 *  ENTARDECER; `periodo` numérico do orçamento fica). Muta no lugar. */
function piorCaso(valor: unknown, chavePai = ""): void {
  if (Array.isArray(valor)) {
    valor.forEach((v) => piorCaso(v, chavePai));
    return;
  }
  if (!valor || typeof valor !== "object" || valor instanceof Date) return;
  const obj = valor as Record<string, unknown>;
  const ehPlano = "takesPrevistos" in obj;

  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") {
      if (k === "periodo") obj[k] = PIOR.periodo;
      else if (TEXTO_LONGO.has(k)) obj[k] = PIOR.sinopse;
      else if (k === "descricao") obj[k] = PIOR.descricaoPlano;
      // `set` do elenco presente é horário (chamada no set), não o set da ficção.
      else if (LOCACAO.has(k) && !(k === "set" && "camarim" in obj)) obj[k] = PIOR.locacao;
      else if (ENDERECO.has(k)) obj[k] = PIOR.endereco;
      else if (k === "personagem") obj[k] = PIOR.personagem;
      else if (k === "ator") obj[k] = PIOR.ator;
      else if (k === "numero") obj[k] = ehPlano ? PIOR.shotNumero : PIOR.sceneNumero;
      else if (k === "sceneNumero") obj[k] = PIOR.sceneNumero;
      else if (k === "paginas") obj[k] = String(PIOR.paginas);
      else if (k in CAMPO_PLANO) obj[k] = CAMPO_PLANO[k];
      else if (k === "funcao") obj[k] = "Assistente de Direção de Arte";
      else if (k === "departamento") obj[k] = "Direção de Arte e Cenografia";
      else if (k === "email") obj[k] = "assistente.direcao.arte@produtora.com.br";
      else if (k === "telefone" || k === "hospitalTelefone") obj[k] = "(11) 99999-9999";
    } else if (typeof v === "number") {
      if (TRES_DIGITOS.has(k)) obj[k] = PIOR.tresDigitos;
      else if (DINHEIRO.has(k)) obj[k] = PIOR.dinheiro;
      else if (k === "paginas") obj[k] = PIOR.paginas;
      else if (k === "percentualHold") obj[k] = 100;
    } else if (v === null) {
      if (k === "periodo" || TEXTO_LONGO.has(k)) obj[k] = k === "periodo" ? PIOR.periodo : PIOR.sinopse;
      else if (k === "ator") obj[k] = PIOR.ator;
      else if (k === "tipo" && "classeLuz" in obj) obj[k] = "EXT";
      else if (LOCACAO.has(k)) obj[k] = PIOR.locacao;
      else if (ENDERECO.has(k)) obj[k] = PIOR.endereco;
      else if (k === "cacheeDiario") obj[k] = PIOR.dinheiro;
      else if (k === "percentualHold") obj[k] = 100;
      else if (k === "numeroDia") obj[k] = 88;
      else if (k in CAMPO_PLANO) obj[k] = CAMPO_PLANO[k];
    } else if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
      if (k === "personagens" || k === "elenco") obj[k] = [...PIOR.ids];
      else if (LISTA_BREAKDOWN.has(k)) obj[k] = [PIOR.personagem, PIOR.ator, PIOR.locacao];
      else if (k === "cenasConcluidas" || k === "cenasNaoConcluidas" || k === "scenesNumeros") {
        obj[k] = Array.from({ length: 6 }, (_, i) => `${100 + i}APL`);
      }
    } else if (v && typeof v === "object") {
      piorCaso(v, k);
    }
  }
  void chavePai;
}

/** Garante N itens numa lista clonando o primeiro (o pior caso de "6 personagens" precisa de 6). */
function completar<T>(lista: T[], n: number, variar: (item: T, i: number) => T): T[] {
  if (lista.length === 0) return lista;
  const out = [...lista];
  for (let i = out.length; i < n; i++) out.push(variar(structuredClone(lista[0]), i));
  return out.map((item, i) => variar(item, i));
}

const TIPOS_RESET: ShotTipoReset[] = ["NENHUM", "RESET_COMPLETO", "TROCA_LENTE", "RESET_POSICAO"];
const PRIORIDADES: ShotPrioridade[] = ["ESSENCIAL", "DESEJAVEL", "SE_DER_TEMPO"];

function planoSintetico(i: number): ShotRow {
  return {
    id: `plano-${i}`,
    ordem: i + 1,
    numero: String(i + 1),
    descricao: "",
    tamanho: null,
    lente: null,
    angulo: null,
    movimento: null,
    takesPrevistos: 1,
    duracaoTakeMin: 1,
    tempoSetupMin: 1,
    tempoTotalMin: 1,
    tempoResetMin: 1,
    tipoReset: TIPOS_RESET[i % TIPOS_RESET.length],
    notasDirecao: null,
    notasContinuidade: null,
    status: i % 3 === 2 ? "DESCARTADO" : "PENDENTE",
    prioridade: PRIORIDADES[i % PRIORIDADES.length],
    scenePartId: null,
  };
}

/** Dados da OD no pior caso. `comOrdemDePlanos` liga a ordem global de planos do dia (a OD e a
 *  Lista de Planos têm layout diferente com e sem ela). */
export function odPiorCaso(base: ShootDayReportData, comOrdemDePlanos: boolean): ShootDayReportData {
  const data = structuredClone(base);
  data.project.logoUrl = null;
  // manhaScenes/tardeScenes/scenes são as mesmas cenas; clonar quebrou a identidade, então o pior
  // caso é aplicado nas três listas.
  for (const scene of [...data.manhaScenes, ...data.tardeScenes, ...data.scenes]) {
    scene.shots = Array.from({ length: 4 }, (_, i) => planoSintetico(i));
    scene.cast = completar(scene.cast, 6, (c, i) => ({ ...c, id: `c${i}`, idCurto: PIOR.ids[i] }));
    if (scene.extras.length === 0) scene.extras = [{ id: "x", personagem: "", quantidade: 1 }];
    scene.shotsTotal = { planosMin: 1, resetsMin: 1, totalMin: 1, count: 1 };
    scene.breakdownSheet ??= {
      figurino: [""],
      make: [""],
      arteDressing: null,
      objetos: [""],
      comidaCena: [""],
      microfones: [""],
      trilha: [""],
      habilidades: [""],
      arteGrafica: [""],
      posProducao: [""],
      notasArte: null,
      notasFoto: null,
      notasSom: null,
      notasContinuidade: null,
      notasProducao: null,
    };
  }
  data.castPresente = completar(data.castPresente, 6, (c, i) => ({ ...c, id: `c${i}`, idCurto: PIOR.ids[i] }));

  const todos = data.scenes.flatMap((s) => s.shots.map((shot) => ({ scene: s, shot })));
  data.shotSchedule = comOrdemDePlanos
    ? todos.map(({ scene, shot }, i) => ({
        id: `sched-${i}`,
        ordem: i,
        bloco: scene.bloco,
        tempoResetMin: shot.tempoResetMin,
        tipoReset: shot.tipoReset,
        shotId: shot.id,
        sceneId: scene.sceneId,
        sceneNumero: scene.numero,
        numero: shot.numero,
        descricao: shot.descricao,
        tamanho: shot.tamanho,
        lente: shot.lente,
        angulo: shot.angulo,
        movimento: shot.movimento,
        takesPrevistos: shot.takesPrevistos,
        duracaoTakeMin: shot.duracaoTakeMin,
        tempoSetupMin: shot.tempoSetupMin,
        tempoTotalMin: shot.tempoTotalMin,
        status: shot.status,
        prioridade: shot.prioridade,
      }))
    : [];
  data.horaAHoraPlanos = data.scenes.map((s) => ({
    sceneId: s.sceneId,
    numero: s.numero,
    tipo: s.tipo,
    periodo: s.periodo,
    classeLuz: s.classeLuz,
    setLocacaoDisplay: s.setLocacaoDisplay,
    sinopseAD: s.sinopseAD ?? "",
    cast: s.cast,
    planos: s.shots.map((shot) => ({
      id: shot.id,
      ordem: shot.ordem,
      numero: shot.numero,
      descricao: shot.descricao,
      tamanho: shot.tamanho,
      lente: shot.lente,
      movimento: shot.movimento,
      takesPrevistos: shot.takesPrevistos,
      tempoTotalMin: shot.tempoTotalMin,
      tempoResetMin: shot.tempoResetMin,
      tipoReset: shot.tipoReset,
      status: shot.status,
      prioridade: shot.prioridade,
      horaInicio: "23:55",
    })),
  }));

  piorCaso(data);

  // Toda linha como parte de cena dividida — o pior caso de largura do número da cena.
  const comParte = `${PIOR.sceneNumero} · ${PIOR.rotuloParte}`;
  for (const scene of [...data.manhaScenes, ...data.tardeScenes, ...data.scenes]) {
    scene.numero = comParte;
    scene.parte = { id: "parte", rotulo: PIOR.rotuloParte, oitavos: 7, vinculo: `${PIOR.rotuloParte.toLowerCase()} na diária 88` };
  }
  for (const entry of data.shotSchedule) entry.sceneNumero = comParte;
  for (const block of data.horaAHoraPlanos) block.numero = comParte;
  return data;
}

// ---------------------------------------------------------------------------
// Documentos
// ---------------------------------------------------------------------------

type Documento = { nome: string; gerar: () => Promise<ReactElement> };

async function montarDocumentos(): Promise<Documento[]> {
  const projeto = await prisma.project.findFirst({ where: { titulo: PROJETO_DEMO } });
  if (!projeto) throw new Error(`Projeto demo "${PROJETO_DEMO}" não encontrado — rode npm run db:seed`);
  const dia = await prisma.shootDay.findFirst({
    where: { projectId: projeto.id },
    orderBy: { scenes: { _count: "desc" } },
  });
  if (!dia) throw new Error("Demo sem diária");
  const draft = await prisma.scriptDraft.findFirst({ where: { projectId: projeto.id }, orderBy: { numero: "desc" } });

  const od = await getShootDayReportData(projeto.id, dia.id);
  if (!od) throw new Error("Diária do demo sem dados");
  const header = { titulo: projeto.titulo, diretor: PIOR.ator, producao: PIOR.locacao };

  const numeroParte = `${PIOR.sceneNumero} · ${PIOR.rotuloParte}`;
  const comPior = <T,>(dados: T): T => {
    const copia = structuredClone(dados);
    piorCaso(copia);
    return copia;
  };

  return [
    { nome: "Ordem do Dia (sem ordem de planos)", gerar: async () => <CallSheetDocument data={odPiorCaso(od, false)} /> },
    { nome: "Ordem do Dia (com ordem de planos)", gerar: async () => <CallSheetDocument data={odPiorCaso(od, true)} /> },
    { nome: "Breakdown da diária", gerar: async () => <BreakdownDocument data={odPiorCaso(od, false)} /> },
    { nome: "Plano HH", gerar: async () => <HHScheduleDocument data={odPiorCaso(od, false)} /> },
    { nome: "Lista de Planos (por cena)", gerar: async () => <ShotListDocument data={odPiorCaso(od, false)} /> },
    { nome: "Lista de Planos (ordem de filmagem)", gerar: async () => <ShotListDocument data={odPiorCaso(od, true)} /> },
    {
      nome: "Boletim de Continuísmo",
      gerar: async () => (
        <ContinuismoDocument
          data={odPiorCaso(od, true)}
          project={{ titulo: projeto.titulo, logoUrl: null, continuismoResponsavel: PIOR.ator, continuismoUsarLogo: false }}
        />
      ),
    },
    {
      nome: "Hora a Hora",
      gerar: async () => {
        const data = odPiorCaso(od, false);
        const eventos = generateHoraAHoraEvents({
          chamadaGeral: data.shootDay.chamadaGeral,
          almocoInicio: data.shootDay.almocoInicio,
          almocoFim: data.shootDay.almocoFim,
          desprodInicio: data.shootDay.desprodInicio,
          scenes: data.scenes,
          castPresente: data.castPresente,
          project: data.project,
        });
        return (
          <HoraAHoraDocument
            data={{
              project: header,
              shootDay: { numeroDia: 88, data: data.shootDay.data },
              events: eventos.map((e, i) => ({ id: String(i), ...e, horaFim: e.horaFim ?? "23:55" })),
            }}
          />
        );
      },
    },
    {
      nome: "Escaleta",
      gerar: async () => {
        const data = comPior(await getEscaletaData(projeto.id));
        data.legend = completar(data.legend, 6, (l, i) => ({ ...l, id: PIOR.ids[i] }));
        return <EscaletaDocument data={data} />;
      },
    },
    {
      nome: "Cronograma de Elenco",
      gerar: async () => {
        const data = comPior(await getCastScheduleData(projeto.id));
        for (const d of data.days) for (const g of d.setGroups) for (const sc of g.scenes) sc.numero = numeroParte;
        return <CastScheduleDocument data={data} />;
      },
    },
    {
      nome: "Plano de Diárias",
      gerar: async () => {
        const data = comPior(await getPlanoSimplesData(projeto.id));
        for (const d of data.days) d.scenesNumeros = d.scenesNumeros.map(() => numeroParte);
        return <PlanoDiariasDocument data={data} />;
      },
    },
    {
      nome: "Plano Semanal",
      gerar: async () => {
        const data = comPior(await getWeeklyPlanData(projeto.id));
        for (const w of data.weeks) for (const d of w.days) for (const c of d.cenas) c.numero = numeroParte;
        return <WeeklyPlanDocument data={data} />;
      },
    },
    {
      nome: "Cenas por Ator",
      gerar: async () => {
        const data = comPior(await getActorSceneListData(projeto.id));
        for (const a of data.actors) for (const sc of a.scenes) sc.numero = numeroParte;
        return <ActorSceneListDocument data={data} />;
      },
    },
    {
      nome: "Cenas por Locação",
      gerar: async () => {
        const data = comPior(await getLocationSceneListData(projeto.id));
        for (const l of data.locations) for (const sc of l.scenes) sc.numero = numeroParte;
        return <LocationSceneListDocument data={data} />;
      },
    },
    {
      nome: "Prestação de Contas do Elenco",
      gerar: async () => {
        const data = comPior(await getCastAccountingData(projeto.id));
        return (
          <CastAccountingDocument
            data={{
              ...header,
              sistemaIdElenco: data.sistemaIdElenco,
              rows: completar(data.rows, 6, (r, i) => ({ ...r, idCurto: PIOR.ids[i] })).map((r) => ({
                ...r,
                diasHold: PIOR.tresDigitos,
              })),
            }}
          />
        );
      },
    },
    {
      nome: "Lista de Contatos da Equipe",
      gerar: async () => {
        const data = await getCrewContactListData(projeto.id);
        if (data.crew.length === 0) {
          data.crew = [{ id: "e", nome: "", funcao: "", departamento: "", telefone: "", email: "" }];
        }
        return <CrewContactListDocument data={comPior(data)} />;
      },
    },
    {
      nome: "Relatório Diário de Produção",
      gerar: async () => {
        const data = await getDailyProgressReportData(projeto.id, dia.id);
        if (!data) throw new Error("Diária do demo sem dados de relatório");
        data.report ??= {
          cenasConcluidas: [],
          cenasNaoConcluidas: [],
          paginasFilmadas: 1,
          horaInicioReal: "07:00",
          horaTerminoReal: "23:55",
          atrasoMin: 1,
          motivoAtraso: null,
          observacoes: null,
        };
        data.report.cenasConcluidas = [""];
        data.report.cenasNaoConcluidas = [""];
        data.report.paginasFilmadas = PIOR.paginas;
        return <DailyProgressReportDocument data={comPior(data)} />;
      },
    },
    {
      nome: "Notas de Continuidade",
      gerar: async () => {
        const data = await getContinuityNotesReportData(projeto.id);
        if (data.scenes.length === 0) data.scenes = [{ numero: "1", notes: [{ texto: "", numeroDia: 1 }] }];
        return <ContinuityNotesDocument data={comPior(data)} />;
      },
    },
    ...(await documentosDeOrcamento(projeto.id, header)),
    ...(draft
      ? [
          {
            nome: "Páginas Alteradas (draft)",
            gerar: async () => {
              const detail = await getScriptDraftDetail(projeto.id, draft.id);
              if (!detail) throw new Error("Draft do demo sem detalhe");
              const modelo = detail.diffs.find((d) => d.scene) ?? null;
              if (modelo) {
                detail.diffs = (["ADICIONADA", "MODIFICADA", "REMOVIDA"] as const).map((tipo, i) => ({
                  ...structuredClone(modelo),
                  numero: `${100 + i}APL`,
                  tipo,
                  scene: tipo === "REMOVIDA" ? null : structuredClone(modelo.scene),
                  camposAlterados:
                    tipo === "MODIFICADA"
                      ? { sinopse: { antes: PIOR.sinopse, depois: `${PIOR.sinopse} Fim.` }, periodo: { antes: "DIA", depois: PIOR.periodo } }
                      : null,
                }));
                for (const d of detail.diffs) {
                  if (d.scene) d.scene.cast = completar(d.scene.cast, 6, (c, i) => ({ ...c, idCurto: PIOR.ids[i] }));
                }
              }
              detail.impacts = [{ sceneNumero: PIOR.sceneNumero, shootDayId: dia.id, numeroDia: 88, motivo: PIOR.sinopse }];
              return <ChangedPagesDocument detail={comPior(detail)} />;
            },
          },
        ]
      : []),
  ];
}

async function documentosDeOrcamento(
  projectId: string,
  header: { titulo: string; diretor: string | null; producao: string | null }
): Promise<Documento[]> {
  const base = await getBudgetData(projectId);
  if (!base) return [];
  const orcamento = (): BudgetData => {
    const b = comPiorOrcamento(base);
    if (b.scenarios.length < 2) {
      const extra = structuredClone(b.scenarios[0] ?? { id: "s", nome: "", notas: null, isBase: true, overrides: [] });
      b.scenarios = [...b.scenarios, { ...extra, id: "cenario-2", nome: PIOR.locacao, isBase: false }];
    }
    return b;
  };
  return [
    { nome: "Orçamento — Topsheet", gerar: async () => <TopsheetDocument budget={orcamento()} projectTitulo={header.titulo} /> },
    { nome: "Orçamento — Detalhado", gerar: async () => <BudgetDetailedDocument budget={orcamento()} project={header} /> },
    { nome: "Orçamento — Comparação de cenários", gerar: async () => <BudgetComparisonDocument budget={orcamento()} projectTitulo={header.titulo} /> },
  ];
}

/** Orçamento no pior caso REALISTA: o piorCaso genérico multiplicaria taxa × quantidade × período
 *  (e globais) até trilhões, largura que nenhum longa brasileiro chega perto. Teto de R$ 9.999.999,99
 *  por linha e globais de 3 dígitos; os totais de grupo passam da casa das centenas de milhões. */
function comPiorOrcamento(base: BudgetData): BudgetData {
  const b = structuredClone(base);
  piorCaso(b);
  for (const g of b.globals) g.valor = PIOR.tresDigitos;
  for (const f of b.fringes) f.teto = f.teto === null ? null : PIOR.dinheiro;
  for (const s of b.scenarios) for (const o of s.overrides) o.valor = PIOR.tresDigitos;
  for (const g of b.accountGroups) {
    for (const a of g.accounts) {
      a.codigo = "1100.99";
      for (const li of a.lineItems) {
        li.unidade = "semanas";
        li.quantidade = 1;
        li.periodo = 1;
        li.taxaCambio = 1;
        li.globalRef = null;
        li.taxa = PIOR.dinheiro;
        li.total = PIOR.dinheiro;
      }
      for (const ac of a.actuals) ac.valor = PIOR.dinheiro;
    }
  }
  return b;
}

// ---------------------------------------------------------------------------

async function main() {
  const saida = process.env.VERIFY_PDF_OUT;
  if (saida) mkdirSync(saida, { recursive: true });

  const documentos = await montarDocumentos();
  let total = 0;
  console.log(`\n=== Colisão de texto nos PDFs (pior caso, ${documentos.length} documentos) ===`);
  for (const doc of documentos) {
    const buffer = await renderToBuffer(await doc.gerar());
    if (saida) writeFileSync(`${saida}/${doc.nome.replace(/[^\p{L}\p{N}]+/gu, "_")}.pdf`, buffer);
    const { colisoes, paginas } = await encontrarColisoes(buffer);
    total += colisoes.length;
    console.log(`  ${colisoes.length === 0 ? "OK  " : "FORA"} ${doc.nome} — ${colisoes.length} colisões (${paginas} pág.)`);
    for (const c of colisoes.slice(0, 8)) {
      console.log(`         p${c.pagina} "${c.a.slice(0, 40)}" × "${c.b.slice(0, 40)}" (folga ${c.folga.toFixed(1)}pt)`);
    }
    if (colisoes.length > 8) console.log(`         … e mais ${colisoes.length - 8}`);
  }

  const { arquivos, quebrados } = await encontrarGlifosQuebrados();
  console.log(`\n=== Caracteres fora da Helvetica (${arquivos} arquivos que geram PDF) ===`);
  if (quebrados.length === 0) console.log("  OK   todo caractere não-ASCII renderiza igual ao escrito");
  for (const q of quebrados) {
    console.log(`  FORA "${q.caractere}" (U+${q.caractere.codePointAt(0)!.toString(16).toUpperCase()}) sai como "${q.lido}" — ${q.onde.slice(0, 4).join(", ")}`);
  }
  total += quebrados.length;

  console.log(`\n${total === 0 ? "TUDO OK" : `FALHOU (${total} problemas)`}`);
  await prisma.$disconnect();
  process.exit(total === 0 ? 0 : 1);
}

if (require.main === module) void main();
