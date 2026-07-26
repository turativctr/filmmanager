import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatFullDate, weekdayNameFull } from "@/lib/calendar-grid";
import { buildCastLegend, getCharacterId } from "@/lib/character-id";
import { formatPaginas } from "@/lib/paginas";
import {
  CallSheetHeader,
  CastLegend,
  colors,
  kit,
  periodoAbrev,
  resetDividerColor,
  resolveLogoBuffer,
  SectionTitle,
  SeparatorRow,
  StandardFooter,
  StandardHeader,
  Table,
  Td,
  TimeRangeCell,
  Tr,
} from "@/lib/pdf/kit";
import { FIXED_SAFETY_RULES } from "@/lib/report-constants";
import type { ShootDayReportData } from "@/lib/report-data";
import { resolveSinopseAD } from "@/lib/scene-sinopse";
import { formatHHh, formatHHhOrDash, minutesToTime, timeToMinutes } from "@/lib/schedule";
import { HEAVY_RESETS, RESET_LABEL } from "@/lib/shots-shared";

const styles = StyleSheet.create({
  logisticsRow: { flexDirection: "row", marginBottom: 8 },
  logisticsCol: {
    flex: 1,
    borderWidth: 0.75,
    borderColor: colors.borderV2,
    padding: 6,
    marginRight: 4,
  },
  logisticsColWide: { flex: 1.3 },
  logisticsColLast: { marginRight: 0, backgroundColor: colors.hospitalBg },
  logisticsRedLabel: { fontWeight: 700, fontSize: 8, marginTop: 4, marginBottom: 1.5, color: colors.danger },
  logisticsSubtitle: { fontWeight: 700, fontSize: 8, marginTop: 4, marginBottom: 1.5 },
  logisticsText: { fontSize: 9, marginBottom: 2 },
  logisticsKvRow: { flexDirection: "row", marginBottom: 1.5 },
  logisticsKvLabel: { fontWeight: 700, fontSize: 8, marginRight: 3 },
  logisticsKvValue: { fontSize: 9, flex: 1 },
  safetyBox: {
    borderWidth: 0.75,
    borderColor: colors.danger,
    backgroundColor: colors.dangerBg,
    padding: 6,
    marginBottom: 8,
  },
  safetyTitle: { fontSize: 8, fontWeight: 700, color: colors.danger, marginBottom: 3 },
  safetyLine: { fontSize: 7, color: colors.danger, marginBottom: 1.5 },
  callBarRow: { flexDirection: "row", marginBottom: 8 },
  callBarCell: {
    width: "16.66%",
    borderWidth: 0.5,
    borderColor: colors.borderV2,
    backgroundColor: colors.lightGray,
    padding: 4,
    alignItems: "center",
  },
  callBarLabel: { fontSize: 8, color: colors.darkGray, marginBottom: 2, textTransform: "uppercase", fontWeight: 700 },
  callBarValue: { fontSize: 12, fontWeight: 700, color: colors.black },
  section: { marginBottom: 10 },
  mealsFooter: {
    flexDirection: "row",
    backgroundColor: colors.lightGray,
    borderWidth: 0.5,
    borderColor: colors.borderV2,
    borderTopWidth: 0,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  mealsFooterText: { fontSize: 8, fontWeight: 700 },
  crewGrid: { flexDirection: "row", flexWrap: "wrap" },
  crewCell: {
    width: "33.33%",
    borderWidth: 0.5,
    borderColor: colors.borderV2,
    padding: 5,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  crewDept: { fontSize: 8, fontWeight: 700 },
  crewTime: { fontSize: 8, textAlign: "right" },
  sceneObsText: { fontSize: 7, fontStyle: "italic", color: colors.medGray },
  obsItem: { fontSize: 9, marginBottom: 5, flexDirection: "row" },
  obsBullet: { marginRight: 4 },
  estimadoMark: { color: colors.medGray },
  estimadoFootnote: { fontSize: 7, color: colors.medGray, marginTop: 3, fontStyle: "italic" },

  // ---- Folha 3 "Hora a Hora com Planos" — caixa por cena + sub-linhas de plano ----
  hhBoxHeader: {
    backgroundColor: colors.lightGray,
    paddingVertical: 3,
    paddingHorizontal: 5,
    borderBottomWidth: 0.75,
    borderBottomColor: colors.borderV2,
  },
  hhBoxHeaderText: { fontSize: 8.5, fontWeight: 700 },
  hhCrossSceneNote: {
    fontSize: 7,
    fontStyle: "italic",
    color: colors.medGray,
    marginTop: 4,
    marginBottom: 2,
  },
  hhResetRow: { paddingVertical: 2, paddingHorizontal: 6, backgroundColor: colors.rowAlt },
  hhPlanoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderTopWidth: 0.5,
    borderTopColor: colors.borderV2,
  },
  hhPlanoHora: { width: "10%", fontSize: 7.5, fontWeight: 700 },
  hhPlanoDescricao: { flex: 1, fontSize: 7.5 },
  hhEmptyText: { fontSize: 9, color: colors.medGray, padding: 8 },
});

/** Divide texto livre em itens: por quebra de linha se houver, senão por frase (". "). */
function splitObservacoes(text: string): string[] {
  const byNewline = text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  if (byNewline.length > 1) return byNewline;
  return text
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function MealsFooterRow({ total, cafe, almoco }: { total: number; cafe: number; almoco: number }) {
  return (
    <View style={styles.mealsFooter}>
      <Text style={styles.mealsFooterText}>
        Total: {total} | Café da manhã: {cafe > 0 ? cafe : "—"} | Almoço: {almoco > 0 ? almoco : "—"}
      </Text>
    </View>
  );
}

/** Linha de "CENAS DO DIA" da Folha 1 — versão resumida (sem SINOPSE, sem sub-linhas de plano) desde
 *  que o detalhe de sinopse foi pra Folha 2 (Escaleta do AD) e o detalhe de plano foi pra Folha 3
 *  (Hora a Hora com Planos). Larguras redistribuem os ~23% liberados pela coluna SINOPSE removida. */
function SceneRow({
  scene,
  alt,
  project,
}: {
  scene: ShootDayReportData["scenes"][number];
  alt: boolean;
  project: ShootDayReportData["project"];
}) {
  return (
    <Tr alt={alt}>
      <Td width="6.7%">{scene.numero}</Td>
      <Td width="10.7%">{scene.tipo ?? "—"}</Td>
      <Td width="6.7%">{scene.periodo ?? "—"}</Td>
      <Td width="20%">{scene.setLocacaoDisplay}</Td>
      <Td width="16%">{scene.cast.map((c) => getCharacterId(c, project)).join(", ") || "—"}</Td>
      <Td width="6.7%" align="right">
        {formatPaginas(scene.paginas)}
      </Td>
      <TimeRangeCell
        width="16.7%"
        start={scene.schedule ? formatHHh(scene.schedule.prepStart) : null}
        end={scene.schedule ? formatHHh(scene.schedule.prepEnd) : null}
      />
      <TimeRangeCell
        width="16.5%"
        start={scene.schedule ? formatHHh(scene.schedule.rodStart) : null}
        end={scene.schedule ? formatHHh(scene.schedule.rodEnd) : null}
      />
    </Tr>
  );
}

/** Linha de "ESCALETA DO AD" (Folha 2) — o CENAS DO DIA original pré-corte, com a sinopse operacional
 *  curta do AD (resolveSinopseAD, com fallback pra sinopse do roteiro truncada) em vez da sinopse crua. */
function SceneRowAD({
  scene,
  alt,
  project,
}: {
  scene: ShootDayReportData["scenes"][number];
  alt: boolean;
  project: ShootDayReportData["project"];
}) {
  return (
    <Tr alt={alt}>
      <Td width="5%">{scene.numero}</Td>
      <Td width="8%">{scene.tipo ?? "—"}</Td>
      <Td width="5%">{scene.periodo ?? "—"}</Td>
      <Td width="15%">{scene.setLocacaoDisplay}</Td>
      <Td width="25%">{resolveSinopseAD(scene) || "—"}</Td>
      <Td width="12%">{scene.cast.map((c) => getCharacterId(c, project)).join(", ") || "—"}</Td>
      <Td width="5%" align="right">
        {formatPaginas(scene.paginas)}
      </Td>
      <TimeRangeCell
        width="12.5%"
        start={scene.schedule ? formatHHh(scene.schedule.prepStart) : null}
        end={scene.schedule ? formatHHh(scene.schedule.prepEnd) : null}
      />
      <TimeRangeCell
        width="12.5%"
        start={scene.schedule ? formatHHh(scene.schedule.rodStart) : null}
        end={scene.schedule ? formatHHh(scene.schedule.rodEnd) : null}
      />
    </Tr>
  );
}

/** Sub-linha com a nota operacional da diária (SceneShootDay.observacoes) logo abaixo de <SceneRow>,
 *  antes dos planos — é uma nota sobre a CENA nesta diária, não sobre um plano específico. Itálico +
 *  cor discreta pra diferenciar das sub-linhas de plano. [] quando vazia. */
function SceneObservacoesRow({ scene }: { scene: ShootDayReportData["scenes"][number] }) {
  if (!scene.observacoes) return null;

  return (
    <Tr wrap={false}>
      <Td width="5%" />
      <Td width="95%">
        <Text style={styles.sceneObsText}>Obs.: {scene.observacoes}</Text>
      </Td>
    </Tr>
  );
}

/** Linhas da seção "ORDEM DE FILMAGEM" — uma por ShotSchedule, na ordem global do dia (planos de
 *  cenas diferentes podem se intercalar aqui, ao contrário da tabela CENAS DO DIA acima). HH acumula
 *  a partir de `startTime`: cada linha mostra o horário ANTES de somar seu tempoEstimadoMin +
 *  tempoResetMin, que empurra a linha seguinte pra frente. Mesmo tratamento visual de reset (divisória
 *  cinza, âmbar em HEAVY_RESETS) do restante do documento — só que aqui a linha não é sub-item de cena. */
function ShotScheduleRows({
  schedule,
  startTime,
}: {
  schedule: ShootDayReportData["shotSchedule"];
  startTime: string | null;
}) {
  let running = startTime ? timeToMinutes(startTime) : null;

  return (
    <>
      {schedule.map((entry, i) => {
        // O reset que empurra o horário DESTA linha é o do plano ANTERIOR (schedule[i-1]) — a
        // arithmetic acumula tempoEstimadoMin+tempoResetMin de cada plano pra chegar no HH do
        // próximo (ver loop abaixo), então a divisória mostrada acima da linha i precisa refletir
        // o campo de schedule[i-1], não o de schedule[i] (senão o texto mostra um reset associado
        // à linha errada, incoerente com os próprios horários calculados).
        const previous = i > 0 ? schedule[i - 1] : null;
        const isHeavyReset = previous ? HEAVY_RESETS.includes(previous.tipoReset) : false;
        const hh = running !== null ? formatHHh(minutesToTime(running)) : "—";
        if (running !== null) running += entry.tempoTotalMin + (entry.tempoResetMin ?? 0);
        const filmado = entry.status === "FILMADO";
        const descartado = entry.status === "DESCARTADO";

        return (
          <View key={entry.id} style={{ width: "100%" }}>
            {previous && previous.tipoReset !== "NENHUM" && previous.tipoReset !== "AJUSTE" && (
              <Tr bg={colors.rowAlt} wrap={false}>
                <Td width="10%" />
                <Td width="90%">
                  <Text style={{ fontSize: 7, color: resetDividerColor(previous.tipoReset) }}>
                    +{previous.tempoResetMin ?? 0}min {RESET_LABEL[previous.tipoReset].toLowerCase()}
                  </Text>
                </Td>
              </Tr>
            )}
            <Tr
              alt={i % 2 === 1}
              bg={
                previous?.tipoReset === "RESET_COMPLETO"
                  ? colors.dangerBg
                  : isHeavyReset
                    ? colors.amberBg
                    : undefined
              }
              wrap={false}
            >
              <Td width="10%" align="center">
                {hh}
              </Td>
              <Td width="15%">
                C{entry.sceneNumero} · P{entry.numero}
              </Td>
              <Td width="45%">
                <Text
                  style={{
                    color: descartado ? colors.medGray : filmado ? colors.success : colors.darkGray,
                    textDecoration: descartado ? "line-through" : undefined,
                  }}
                >
                  {entry.descricao}
                </Text>
              </Td>
              <Td width="15%">{entry.lente || "—"}</Td>
              <Td width="15%" align="center">
                {entry.tempoTotalMin}min ({entry.takesPrevistos}T)
              </Td>
            </Tr>
          </View>
        );
      })}
    </>
  );
}

/** Sub-linha de plano dentro de uma caixa da Folha 3 (Hora a Hora com Planos). Convenção de reset:
 *  usa o tipoReset/tempoResetMin do PRÓPRIO plano iterado (não do anterior) quando `index > 0` — o
 *  mesmo critério do antigo ShotSubRows do Call Sheet, diferente de ShotScheduleRows acima (que usa
 *  o campo do item anterior por motivos específicos daquela tabela). O reset do plano `index === 0`
 *  de cada caixa é tratado FORA daqui, como anotação "troca de cena" acima da caixa (ver HoraAHoraBox). */
function PlanoRowAD({
  plano,
  index,
}: {
  plano: ShootDayReportData["horaAHoraPlanos"][number]["planos"][number];
  index: number;
}) {
  const isHeavyReset = index > 0 && HEAVY_RESETS.includes(plano.tipoReset);
  const filmado = plano.status === "FILMADO";
  const descartado = plano.status === "DESCARTADO";

  return (
    <View style={{ width: "100%" }}>
      {index > 0 && plano.tipoReset !== "NENHUM" && plano.tipoReset !== "AJUSTE" && (
        <View style={styles.hhResetRow} wrap={false}>
          <Text style={{ fontSize: 7, color: resetDividerColor(plano.tipoReset) }}>
            +{plano.tempoResetMin ?? 0}min {RESET_LABEL[plano.tipoReset].toLowerCase()}
          </Text>
        </View>
      )}
      <View
        style={{
          ...styles.hhPlanoRow,
          backgroundColor:
            plano.tipoReset === "RESET_COMPLETO" ? colors.dangerBg : isHeavyReset ? colors.amberBg : undefined,
        }}
        wrap={false}
      >
        <Text style={styles.hhPlanoHora}>{plano.horaInicio ? formatHHh(plano.horaInicio) : "—"}</Text>
        <Text
          style={{
            ...styles.hhPlanoDescricao,
            color: descartado ? colors.medGray : filmado ? colors.success : colors.darkGray,
            textDecoration: descartado ? "line-through" : undefined,
          }}
        >
          P{plano.numero} · {plano.tamanho || "—"} · {plano.movimento || "—"} · {plano.descricao} ·{" "}
          {plano.takesPrevistos}T × {plano.tempoTotalMin}min
        </Text>
      </View>
    </View>
  );
}

/** Caixa de uma cena na Folha 3 — cabeçalho com os dados operacionais da cena (tipo, período,
 *  set/locação, sinopse do AD, elenco) seguido dos planos em ordem. `wrap={false}` mantém a caixa
 *  inteira junto ao virar página, no mesmo peso visual de outras seções com borda deste documento
 *  (ex.: styles.logisticsCol). */
function HoraAHoraBox({
  block,
  project,
}: {
  block: ShootDayReportData["horaAHoraPlanos"][number];
  project: ShootDayReportData["project"];
}) {
  const castLabel = block.cast.map((c) => getCharacterId(c, project)).join(", ") || "—";

  return (
    <View style={{ borderWidth: 0.75, borderColor: colors.borderV2, marginBottom: 6 }} wrap={false}>
      <View style={styles.hhBoxHeader}>
        <Text style={styles.hhBoxHeaderText}>
          Cena {block.numero} · {block.tipo ?? "—"} · {periodoAbrev(block.periodo)} · {block.setLocacaoDisplay} —{" "}
          {block.sinopseAD || "—"} · {castLabel}
        </Text>
      </View>
      {block.planos.map((plano, i) => (
        <PlanoRowAD key={plano.id} plano={plano} index={i} />
      ))}
    </View>
  );
}

export function CallSheetDocument({ data }: { data: ShootDayReportData }) {
  const {
    project,
    shootDay,
    totalShootDays,
    manhaScenes,
    tardeScenes,
    castPresente,
    castMeals,
    extrasPresente,
    extrasMeals,
    chamadaEquipeList,
    rodStartManha,
    rodStartTarde,
    shotSchedule,
    horaAHoraPlanos,
  } = data;

  const scenesByCharacter = new Map<string, string[]>();
  const scenesByExtra = new Map<string, string[]>();
  for (const scene of [...manhaScenes, ...tardeScenes]) {
    for (const c of scene.cast) {
      scenesByCharacter.set(c.id, [...(scenesByCharacter.get(c.id) ?? []), scene.numero]);
    }
    for (const e of scene.extras) {
      scenesByExtra.set(e.id, [...(scenesByExtra.get(e.id) ?? []), scene.numero]);
    }
  }

  const callBar = [
    { label: "Chamada Geral", value: shootDay.chamadaGeral },
    { label: "Lanche", value: shootDay.lancheHorario },
    { label: "Rodando", value: rodStartManha },
    { label: "Almoço", value: shootDay.almocoInicio },
    { label: "Rodando Pós Almoço", value: rodStartTarde },
    { label: "Desprodução", value: shootDay.desprodInicio },
  ];

  const observacoes = shootDay.observacoesGerais ? splitObservacoes(shootDay.observacoesGerais) : [];
  const logoSrc = resolveLogoBuffer(project.logoUrl);
  const castLegend = buildCastLegend(castPresente, project);

  const escaletaTitle = `Escaleta do AD — Diária ${shootDay.numeroDia} — ${weekdayNameFull(shootDay.data)}, ${formatFullDate(shootDay.data)}`;
  const horaAHoraTitle = `Hora a Hora com Planos — Diária ${shootDay.numeroDia} — ${weekdayNameFull(shootDay.data)}, ${formatFullDate(shootDay.data)}`;

  return (
    <Document>
      {/* ---------------------------------------------------------------- */}
      {/* Folha 1 — Ordem do Dia (logística, segurança, chamadas, cenas)   */}
      {/* ---------------------------------------------------------------- */}
      <Page size="A4" style={kit.pageV2}>
        <CallSheetHeader
          projectTitulo={project.titulo}
          diretor={project.diretor}
          producao={project.producao}
          logoSrc={logoSrc}
          numeroDia={shootDay.numeroDia}
          totalShootDays={totalShootDays}
          weekday={weekdayNameFull(shootDay.data)}
          fullDate={formatFullDate(shootDay.data)}
        />

        <View style={styles.logisticsRow}>
          <View style={{ ...styles.logisticsCol, ...styles.logisticsColWide }}>
            <Text style={styles.logisticsRedLabel}>TRANSPORTE</Text>
            <View style={styles.logisticsKvRow}>
              <Text style={styles.logisticsKvLabel}>Horário:</Text>
              <Text style={styles.logisticsKvValue}>{formatHHhOrDash(shootDay.transporteHorario)}</Text>
            </View>
            <Text style={styles.logisticsText}>{shootDay.transporteEndereco || "—"}</Text>
            <Text style={styles.logisticsRedLabel}>LOCAÇÃO</Text>
            <View style={styles.logisticsKvRow}>
              <Text style={styles.logisticsKvLabel}>Nome:</Text>
              <Text style={styles.logisticsKvValue}>{shootDay.locacaoNome || "—"}</Text>
            </View>
            <Text style={styles.logisticsText}>{shootDay.locacaoEndereco || "—"}</Text>
          </View>
          <View style={styles.logisticsCol}>
            <Text style={styles.logisticsRedLabel}>BASE/ALIMENTAÇÃO</Text>
            <Text style={styles.logisticsText}>{shootDay.baseInfo || "—"}</Text>
            <Text style={styles.logisticsRedLabel}>ESTACIONAMENTO</Text>
            <Text style={styles.logisticsText}>{shootDay.estacionamento || "—"}</Text>
          </View>
          <View style={styles.logisticsCol}>
            <Text style={styles.logisticsSubtitle}>HOSPITAL</Text>
            <View style={styles.logisticsKvRow}>
              <Text style={styles.logisticsKvLabel}>Nome:</Text>
              <Text style={styles.logisticsKvValue}>{shootDay.hospitalNome || "—"}</Text>
            </View>
            <Text style={styles.logisticsText}>{shootDay.hospitalEndereco || "—"}</Text>
            <View style={styles.logisticsKvRow}>
              <Text style={styles.logisticsKvLabel}>Telefone:</Text>
              <Text style={styles.logisticsKvValue}>{shootDay.hospitalTelefone || "—"}</Text>
            </View>
          </View>
          <View style={{ ...styles.logisticsCol, ...styles.logisticsColLast }}>
            <Text style={styles.logisticsRedLabel}>METEOROLOGIA</Text>
            <View style={styles.logisticsKvRow}>
              <Text style={styles.logisticsKvLabel}>Nascer/Pôr:</Text>
              <Text style={styles.logisticsKvValue}>
                {formatHHhOrDash(shootDay.meteoNascer)} / {formatHHhOrDash(shootDay.meteoPor)}
              </Text>
            </View>
            <View style={styles.logisticsKvRow}>
              <Text style={styles.logisticsKvLabel}>Mín/Máx:</Text>
              <Text style={styles.logisticsKvValue}>
                {shootDay.meteoMin ?? "—"}°C / {shootDay.meteoMax ?? "—"}°C
              </Text>
            </View>
            <View style={styles.logisticsKvRow}>
              <Text style={styles.logisticsKvLabel}>Chuva:</Text>
              <Text style={styles.logisticsKvValue}>{shootDay.meteoChuva || "—"}</Text>
            </View>
            {shootDay.meteoDescricao ? <Text style={styles.logisticsText}>{shootDay.meteoDescricao}</Text> : null}
          </View>
        </View>

        <View style={styles.safetyBox}>
          <Text style={styles.safetyTitle}>CONDUTA E SEGURANÇA NO SET</Text>
          {FIXED_SAFETY_RULES.map((rule) => (
            <Text key={rule} style={styles.safetyLine}>
              - {rule}
            </Text>
          ))}
        </View>

        <View style={styles.callBarRow}>
          {callBar.map((item) => (
            <View key={item.label} style={styles.callBarCell}>
              <Text style={styles.callBarLabel}>{item.label}</Text>
              <Text style={styles.callBarValue}>{formatHHhOrDash(item.value)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section} wrap={false}>
          <SectionTitle>CHAMADA DA EQUIPE</SectionTitle>
          <View style={styles.crewGrid}>
            {chamadaEquipeList.map((item) => (
              <View key={item.departamento} style={styles.crewCell}>
                <Text style={styles.crewDept}>{item.departamento}</Text>
                <Text style={styles.crewTime}>{formatHHhOrDash(item.horario)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle>ELENCO</SectionTitle>
          <Table>
            <Tr header dark>
              <Td width="8%">ID</Td>
              <Td width="16%">PERSONAGEM</Td>
              <Td width="18%">ATOR</Td>
              <Td width="14%">CENAS</Td>
              <Td width="11%" align="center">
                CHEGADA
              </Td>
              <Td width="11%" align="center">
                CAMARIM
              </Td>
              <Td width="11%" align="center">
                RODAR
              </Td>
              <Td width="11%" align="center">
                SAÍDA
              </Td>
            </Tr>
            {castPresente.map((c, i) => (
              <Tr key={c.id} alt={i % 2 === 1}>
                <Td width="8%">{getCharacterId(c, project)}</Td>
                <Td width="16%">{c.personagem}</Td>
                <Td width="18%">{c.ator || "—"}</Td>
                <Td width="14%">{(scenesByCharacter.get(c.id) ?? []).join(", ") || "—"}</Td>
                <Td width="11%" align="center">
                  {formatHHhOrDash(c.chamada)}
                  {c.estimado && <Text style={styles.estimadoMark}> *</Text>}
                </Td>
                <Td width="11%" align="center">
                  {formatHHhOrDash(c.camarim)}
                  {c.estimado && <Text style={styles.estimadoMark}> *</Text>}
                </Td>
                <Td width="11%" align="center">
                  {formatHHhOrDash(c.set)}
                  {c.estimado && <Text style={styles.estimadoMark}> *</Text>}
                </Td>
                <Td width="11%" align="center">
                  {formatHHhOrDash(c.saida)}
                </Td>
              </Tr>
            ))}
          </Table>
          <MealsFooterRow total={castMeals.total} cafe={castMeals.cafe} almoco={castMeals.almoco} />
          {castPresente.some((c) => c.estimado) && (
            <Text style={styles.estimadoFootnote}>* horário estimado — sem apontamento manual cadastrado</Text>
          )}
        </View>

        {extrasPresente.length > 0 && (
          <View style={styles.section}>
            <SectionTitle>FIGURAÇÃO</SectionTitle>
            <Table>
              <Tr header dark>
                <Td width="30%">PERSONAGEM</Td>
                <Td width="12%" align="center">
                  QTD.
                </Td>
                <Td width="28%">CENAS</Td>
                <Td width="15%" align="center">
                  CHEGADA
                </Td>
                <Td width="15%" align="center">
                  SAÍDA
                </Td>
              </Tr>
              {extrasPresente.map((e, i) => (
                <Tr key={e.id} alt={i % 2 === 1}>
                  <Td width="30%">{e.personagem}</Td>
                  <Td width="12%" align="center">
                    {e.quantidade}
                  </Td>
                  <Td width="28%">{(scenesByExtra.get(e.id) ?? []).join(", ") || "—"}</Td>
                  <Td width="15%" align="center">
                    {formatHHhOrDash(e.chamada)}
                  </Td>
                  <Td width="15%" align="center">
                    {formatHHhOrDash(e.saida)}
                  </Td>
                </Tr>
              ))}
            </Table>
            <MealsFooterRow total={extrasMeals.total} cafe={extrasMeals.cafe} almoco={extrasMeals.almoco} />
          </View>
        )}

        <View style={styles.section}>
          <SectionTitle>CENAS DO DIA</SectionTitle>
          {castLegend && <CastLegend entries={castLegend} />}
          <Table>
            <Tr header dark>
              <Td width="6.7%">CENA</Td>
              <Td width="10.7%">INT/EXT</Td>
              <Td width="6.7%">D/N</Td>
              <Td width="20%">SET / LOCAÇÃO</Td>
              <Td width="16%">ELENCO</Td>
              <Td width="6.7%" align="right">
                PÁGS
              </Td>
              <Td width="16.7%" align="center">
                PREP
              </Td>
              <Td width="16.5%" align="center">
                ROD
              </Td>
            </Tr>
            {manhaScenes.map((scene, i) => (
              <View key={scene.sceneId} style={{ width: "100%" }}>
                <SceneRow scene={scene} alt={i % 2 === 1} project={project} />
                <SceneObservacoesRow scene={scene} />
              </View>
            ))}
            {(shootDay.almocoInicio || tardeScenes.length > 0) && (
              <SeparatorRow
                bg={colors.separatorBg}
                label={`ALMOÇO${shootDay.almocoInicio ? ` — ${formatHHh(shootDay.almocoInicio)}` : ""}${
                  shootDay.almocoFim ? ` às ${formatHHh(shootDay.almocoFim)}` : ""
                }`}
              />
            )}
            {tardeScenes.map((scene, i) => (
              <View key={scene.sceneId} style={{ width: "100%" }}>
                <SceneRow scene={scene} alt={i % 2 === 1} project={project} />
                <SceneObservacoesRow scene={scene} />
              </View>
            ))}
            {shootDay.desprodInicio && (
              <SeparatorRow bg={colors.separatorBg} label={`DESPRODUÇÃO — ${formatHHh(shootDay.desprodInicio)}`} />
            )}
          </Table>
        </View>

        {shotSchedule.length > 0 && (
          <View style={styles.section}>
            <SectionTitle>ORDEM DE FILMAGEM</SectionTitle>
            <Table>
              <Tr header dark>
                <Td width="10%" align="center">
                  HH
                </Td>
                <Td width="15%">CENA · PLANO</Td>
                <Td width="45%">DESCRIÇÃO</Td>
                <Td width="15%">LENTE</Td>
                <Td width="15%" align="center">
                  TEMPO
                </Td>
              </Tr>
              <ShotScheduleRows schedule={shotSchedule} startTime={shootDay.blocoManhaInicio ?? shootDay.chamadaGeral} />
            </Table>
          </View>
        )}

        <View style={styles.section} wrap={false}>
          <SectionTitle>OBSERVAÇÕES GERAIS</SectionTitle>
          {observacoes.length === 0 ? (
            <Text style={styles.logisticsText}>—</Text>
          ) : (
            observacoes.map((item, i) => (
              <View key={i} style={styles.obsItem}>
                <Text style={styles.obsBullet}>•</Text>
                <Text style={{ flex: 1 }}>{item}</Text>
              </View>
            ))
          )}
        </View>

        <StandardFooter projectTitulo={project.titulo} documentName="Ordem do Dia" />
      </Page>

      {/* ---------------------------------------------------------------- */}
      {/* Folha 2 — Escaleta do AD (todas as cenas, com sinopse operacional) */}
      {/* ---------------------------------------------------------------- */}
      <Page size="A4" style={kit.pageV2}>
        <StandardHeader
          projectTitulo={project.titulo}
          diretor={project.diretor}
          producao={project.producao}
          documentTitle={escaletaTitle}
        />

        <Table>
          <Tr header dark>
            <Td width="5%">CENA</Td>
            <Td width="8%">INT/EXT</Td>
            <Td width="5%">D/N</Td>
            <Td width="15%">SET / LOCAÇÃO</Td>
            <Td width="25%">SINOPSE CURTA</Td>
            <Td width="12%">ELENCO</Td>
            <Td width="5%" align="right">
              PÁGS
            </Td>
            <Td width="12.5%" align="center">
              PREP
            </Td>
            <Td width="12.5%" align="center">
              ROD
            </Td>
          </Tr>
          {manhaScenes.map((scene, i) => (
            <SceneRowAD key={scene.sceneId} scene={scene} alt={i % 2 === 1} project={project} />
          ))}
          {(shootDay.almocoInicio || tardeScenes.length > 0) && (
            <SeparatorRow
              bg={colors.separatorBg}
              label={`ALMOÇO${shootDay.almocoInicio ? ` — ${formatHHh(shootDay.almocoInicio)}` : ""}${
                shootDay.almocoFim ? ` às ${formatHHh(shootDay.almocoFim)}` : ""
              }`}
            />
          )}
          {tardeScenes.map((scene, i) => (
            <SceneRowAD key={scene.sceneId} scene={scene} alt={i % 2 === 1} project={project} />
          ))}
          {shootDay.desprodInicio && (
            <SeparatorRow bg={colors.separatorBg} label={`DESPRODUÇÃO — ${formatHHh(shootDay.desprodInicio)}`} />
          )}
        </Table>

        <StandardFooter projectTitulo={project.titulo} documentName="Escaleta do AD" />
      </Page>

      {/* ---------------------------------------------------------------- */}
      {/* Folha 3+ — Hora a Hora com Planos (uma caixa por cena/retomada)   */}
      {/* ---------------------------------------------------------------- */}
      <Page size="A4" style={kit.pageV2}>
        <StandardHeader
          projectTitulo={project.titulo}
          diretor={project.diretor}
          producao={project.producao}
          documentTitle={horaAHoraTitle}
        />

        {horaAHoraPlanos.length === 0 ? (
          <Text style={styles.hhEmptyText}>Nenhum plano cadastrado para esta diária.</Text>
        ) : (
          horaAHoraPlanos.map((block, blockIndex) => {
            const firstPlano = block.planos[0];
            // Reset do 1º plano de uma caixa reflete a transição vinda de FORA dela (troca de cena
            // via reordenação por ShotSchedule) — não tem "plano anterior" dentro da própria caixa
            // pra desenhar a divisória de reset, então vira uma anotação separada, acima da caixa.
            const crossSceneReset = firstPlano && firstPlano.tipoReset !== "NENHUM" && firstPlano.tipoReset !== "AJUSTE";

            return (
              <View key={`${block.sceneId}-${blockIndex}`} style={{ width: "100%" }}>
                {crossSceneReset && (
                  <Text style={{ ...styles.hhCrossSceneNote, color: resetDividerColor(firstPlano.tipoReset) }}>
                    Troca de cena — +{firstPlano.tempoResetMin ?? 0}min {RESET_LABEL[firstPlano.tipoReset].toLowerCase()}
                  </Text>
                )}
                <HoraAHoraBox block={block} project={project} />
              </View>
            );
          })
        )}

        <StandardFooter projectTitulo={project.titulo} documentName="Hora a Hora com Planos" />
      </Page>
    </Document>
  );
}
