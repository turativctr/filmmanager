import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatFullDate, weekdayNameFull } from "@/lib/calendar-grid";
import { colors, kit, SeparatorRow, StandardFooter, StandardHeader, Table, Td, Tr } from "@/lib/pdf/kit";
import type { ShootDayReportData } from "@/lib/report-data";
import { HEAVY_RESETS, isDetalheOuInsert, RESET_LABEL } from "@/lib/shots-shared";
import type { ShotTipoReset } from "@prisma/client";

/** Correção 1: NENHUM/AJUSTE não têm divisória; TROCA_LENTE/TROCA_CAMERA usam cinza neutro;
 *  RESET_POSICAO usa âmbar; RESET_COMPLETO usa vermelho/perigo — mesma lógica do Call Sheet/Plano HH. */
function resetDividerColor(tipoReset: ShotTipoReset): string {
  if (tipoReset === "RESET_COMPLETO") return colors.danger;
  if (tipoReset === "RESET_POSICAO") return colors.amber;
  return colors.medGray;
}

const styles = StyleSheet.create({
  sceneSection: { marginBottom: 12, borderWidth: 0.75, borderColor: colors.borderV2 },
  sceneHeader: { backgroundColor: colors.tableHeaderBg, padding: 5 },
  sceneHeaderTitle: { fontSize: 9, fontWeight: 700, color: "#ffffff" },
  sceneBody: { padding: 5 },
  sceneSinopse: { fontSize: 8, marginBottom: 3 },
  sceneTotais: { fontSize: 7.5, color: colors.medGray, marginBottom: 6 },
  emptyText: { fontSize: 8, color: colors.medGray, fontStyle: "italic" },
  statusDescartado: { color: colors.medGray, textDecoration: "line-through" },
});

/** Linhas da ordem de filmagem do dia (ShotSchedule) — sequência única cruzando cenas, em vez do
 *  agrupamento por cena abaixo. O rótulo "Cena X · Plano Y" aparece por linha (não há mais um cabeçalho
 *  de cena que o implique). Mesmo tratamento visual de reset/destaque do agrupamento por cena. */
function ShotScheduleRows({ schedule }: { schedule: ShootDayReportData["shotSchedule"] }) {
  return (
    <>
      {schedule.map((entry, i) => {
        // O reset exibido pra linha i (tanto na divisória quanto na coluna RESET) é o campo do
        // plano ANTERIOR na ordem do dia (schedule[i-1]) — em ShotSchedule o reset fica associado
        // a QUEM o antecede (empurra o HH do próximo plano, ver ShotScheduleRows em
        // call-sheet-document.tsx), ao contrário de Shot (por cena), onde o próprio plano carrega
        // o reset necessário pra alcançá-lo. Usar o campo errado aqui mostraria o reset associado
        // à linha errada.
        const previous = i > 0 ? schedule[i - 1] : null;
        const isHeavyReset = previous ? HEAVY_RESETS.includes(previous.tipoReset) : false;
        const isDetalheRow = isDetalheOuInsert(entry.tamanho);
        const filmado = entry.status === "FILMADO";
        const descartado = entry.status === "DESCARTADO";

        const previousHasReset = previous ? previous.tipoReset !== "NENHUM" && previous.tipoReset !== "AJUSTE" : false;

        return (
          <View key={entry.id} style={{ width: "100%" }}>
            {previous && previousHasReset && (
              <SeparatorRow
                bg={isHeavyReset ? (previous.tipoReset === "RESET_COMPLETO" ? colors.dangerBg : colors.amberBg) : colors.rowAlt}
                textColor={resetDividerColor(previous.tipoReset)}
                label={`+${previous.tempoResetMin ?? 0}min ${RESET_LABEL[previous.tipoReset].toLowerCase()}`}
              />
            )}
            <Tr alt={i % 2 === 1} bg={isDetalheRow ? colors.amberBg : undefined} wrap={false}>
              <Td width="9%">
                <Text style={{ fontWeight: 700, color: filmado ? colors.success : undefined }}>
                  Cena {entry.sceneNumero} · Plano {entry.numero}
                </Text>
              </Td>
              <Td width="22%">
                <Text style={descartado ? styles.statusDescartado : undefined}>{entry.descricao}</Text>
              </Td>
              <Td width="8%">{entry.tamanho || "—"}</Td>
              <Td width="7%">{entry.lente || "—"}</Td>
              <Td width="7%">{entry.angulo || "—"}</Td>
              <Td width="8%">{entry.movimento || "—"}</Td>
              <Td width="11%">{previousHasReset ? RESET_LABEL[previous!.tipoReset] : "—"}</Td>
              <Td width="6%" align="center">
                {entry.takesPrevistos}
              </Td>
              <Td width="7%" align="center">
                {entry.duracaoTakeMin}
              </Td>
              <Td width="8%" align="center">
                {entry.tempoSetupMin}
              </Td>
              <Td width="7%" align="center">
                {entry.tempoTotalMin}
              </Td>
            </Tr>
          </View>
        );
      })}
    </>
  );
}

/** Lista de planos (Shot List) — um dos documentos por diária, ao lado do Call Sheet e do Plano HH.
 *  Quando a diária tem ShotSchedule (ordem de filmagem por plano, cruzando cenas), renderiza em
 *  sequência única nessa ordem; senão mantém o agrupamento por cena original (fallback/padrão).
 *  Reset entre planos aparece como linha divisória (mesmo tratamento visual usado no Call Sheet/Plano
 *  HH — ver ShotSubRows em call-sheet-document.tsx/hh-schedule-document.tsx), e planos Detalhe/Insert
 *  ou logo após um reset pesado (HEAVY_RESETS) recebem destaque âmbar. */
export function ShotListDocument({ data }: { data: ShootDayReportData }) {
  const { project, shootDay, totalShootDays, scenes, shotSchedule } = data;

  return (
    <Document>
      <Page size="A4" style={kit.pageV2}>
        <StandardHeader
          projectTitulo={project.titulo}
          diretor={project.diretor}
          producao={project.producao}
          documentTitle={`Lista de Planos — Diária ${shootDay.numeroDia} de ${totalShootDays} — ${weekdayNameFull(
            shootDay.data
          )}, ${formatFullDate(shootDay.data)}`}
        />

        {shotSchedule.length > 0 ? (
          <View style={styles.sceneSection}>
            <View style={styles.sceneHeader}>
              <Text style={styles.sceneHeaderTitle}>Ordem de Filmagem — Diária {shootDay.numeroDia}</Text>
            </View>
            <View style={styles.sceneBody}>
              <Table>
                <Tr header dark>
                  <Td width="9%">CENA · PLANO</Td>
                  <Td width="22%">DESCRIÇÃO</Td>
                  <Td width="8%">TAMANHO</Td>
                  <Td width="7%">LENTE</Td>
                  <Td width="7%">ÂNGULO</Td>
                  <Td width="8%">MOVIMENTO</Td>
                  <Td width="11%">RESET</Td>
                  <Td width="6%" align="center">
                    TAKES
                  </Td>
                  <Td width="7%" align="center">
                    MIN/TAKE
                  </Td>
                  <Td width="8%" align="center">
                    SETUP
                  </Td>
                  <Td width="7%" align="center">
                    TOTAL
                  </Td>
                </Tr>
                <ShotScheduleRows schedule={shotSchedule} />
              </Table>
            </View>
          </View>
        ) : (
          <>
            {scenes.length === 0 && <Text style={kit.muted}>Nenhuma cena cadastrada nesta diária.</Text>}

            {scenes.map((scene) => {
              const totals = scene.shotsTotal ?? { planosMin: 0, resetsMin: 0, totalMin: 0, count: 0 };

              return (
                <View key={scene.sceneId} style={styles.sceneSection} wrap={false}>
                  <View style={styles.sceneHeader}>
                    <Text style={styles.sceneHeaderTitle}>
                      Cena {scene.numero} · {scene.tipo ?? "—"}/{scene.periodo ?? "—"} · {scene.setLocacaoDisplay}
                    </Text>
                  </View>
                  <View style={styles.sceneBody}>
                    <Text style={styles.sceneSinopse}>{scene.sinopse || "Sem sinopse."}</Text>
                    <Text style={styles.sceneTotais}>
                      {totals.count} plano{totals.count === 1 ? "" : "s"} · {totals.planosMin} min de planos +{" "}
                      {totals.resetsMin} min de resets = {totals.totalMin} min totais
                    </Text>

                    {scene.shots.length === 0 ? (
                      <Text style={styles.emptyText}>Nenhum plano cadastrado nesta cena.</Text>
                    ) : (
                      <Table>
                        <Tr header dark>
                          <Td width="4%">Nº</Td>
                          <Td width="19%">DESCRIÇÃO</Td>
                          <Td width="7%">TAMANHO</Td>
                          <Td width="6%">LENTE</Td>
                          <Td width="6%">ÂNGULO</Td>
                          <Td width="7%">MOVIMENTO</Td>
                          <Td width="9%">RESET</Td>
                          <Td width="5%" align="center">
                            TAKES
                          </Td>
                          <Td width="6%" align="center">
                            MIN/TAKE
                          </Td>
                          <Td width="8%" align="center">
                            SETUP
                          </Td>
                          <Td width="6%" align="center">
                            TOTAL
                          </Td>
                          <Td width="8%">NOTAS DIR.</Td>
                          <Td width="9%">NOTAS CONT.</Td>
                        </Tr>
                        {scene.shots.map((shot, i) => {
                          const isHeavyReset = i > 0 && HEAVY_RESETS.includes(shot.tipoReset);
                          const isDetalheRow = isDetalheOuInsert(shot.tamanho);
                          const filmado = shot.status === "FILMADO";
                          const descartado = shot.status === "DESCARTADO";
                          const hasReset = i > 0 && shot.tipoReset !== "NENHUM" && shot.tipoReset !== "AJUSTE";

                          return (
                            <View key={shot.id} style={{ width: "100%" }}>
                              {hasReset && (
                                <SeparatorRow
                                  bg={
                                    isHeavyReset
                                      ? shot.tipoReset === "RESET_COMPLETO"
                                        ? colors.dangerBg
                                        : colors.amberBg
                                      : colors.rowAlt
                                  }
                                  textColor={resetDividerColor(shot.tipoReset)}
                                  label={`+${shot.tempoResetMin ?? 0}min ${RESET_LABEL[shot.tipoReset].toLowerCase()}`}
                                />
                              )}
                              <Tr alt={i % 2 === 1} bg={isDetalheRow ? colors.amberBg : undefined} wrap={false}>
                                <Td width="4%">
                                  <Text style={filmado ? { color: colors.success, fontWeight: 700 } : undefined}>
                                    {shot.ordem}
                                  </Text>
                                </Td>
                                <Td width="19%">
                                  <Text style={descartado ? styles.statusDescartado : undefined}>
                                    {shot.descricao}
                                  </Text>
                                </Td>
                                <Td width="7%">{shot.tamanho || "—"}</Td>
                                <Td width="6%">{shot.lente || "—"}</Td>
                                <Td width="6%">{shot.angulo || "—"}</Td>
                                <Td width="7%">{shot.movimento || "—"}</Td>
                                <Td width="9%">
                                  {shot.tipoReset !== "NENHUM" ? RESET_LABEL[shot.tipoReset] : "—"}
                                </Td>
                                <Td width="5%" align="center">
                                  {shot.takesPrevistos}
                                </Td>
                                <Td width="6%" align="center">
                                  {shot.duracaoTakeMin}
                                </Td>
                                <Td width="8%" align="center">
                                  {shot.tempoSetupMin}
                                </Td>
                                <Td width="6%" align="center">
                                  {shot.tempoTotalMin}
                                </Td>
                                <Td width="8%">{shot.notasDirecao || "—"}</Td>
                                <Td width="9%">{shot.notasContinuidade || "—"}</Td>
                              </Tr>
                            </View>
                          );
                        })}
                      </Table>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        )}

        <StandardFooter projectTitulo={project.titulo} documentName="Lista de Planos" />
      </Page>
    </Document>
  );
}
