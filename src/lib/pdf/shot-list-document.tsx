import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { Fragment } from "react";

import { formatFullDate, weekdayNameFull } from "@/lib/calendar-grid";
import {
  colors,
  kit,
  PRIORIDADE_COL_PT,
  SeparatorRow,
  StandardFooter,
  StandardHeader,
  Table,
  Td,
  Tr,
} from "@/lib/pdf/kit";
import type { ShootDayReportData } from "@/lib/report-data";
import { HEAVY_RESETS, isDetalheOuInsert, PRIORIDADE_INICIAL, RESET_LABEL } from "@/lib/shots-shared";
import type { ShotTipoReset } from "@prisma/client";

/** Correção 1: NENHUM/AJUSTE não têm divisória; TROCA_LENTE/TROCA_CAMERA usam cinza neutro;
 *  RESET_POSICAO usa âmbar; RESET_COMPLETO usa vermelho/perigo — mesma lógica do Call Sheet/Plano HH. */
function resetDividerColor(tipoReset: ShotTipoReset): string {
  if (tipoReset === "RESET_COMPLETO") return colors.danger;
  if (tipoReset === "RESET_POSICAO") return colors.amber;
  return colors.medGray;
}

// Larguras em PONTOS, medidas pelo pior valor em Helvetica (8.5 no corpo, 8 negrito no cabeçalho)
// + 8pt de padding da célula. Com 13 colunas, os títulos inteiros das colunas curtas somam ~464pt —
// não cabem nos 519pt úteis da A4 em retrato; por isso o documento é em paisagem (766pt úteis).
// DESCRIÇÃO e NOTAS dividem o que sobra.
const COL = {
  ordem: 23, // "888" = 14pt
  cenaPlano: 111, // "Cena 102APL · Plano 12B" em negrito = 102pt, numa linha só
  tamanho: 61, // "Primeiríssimo" = 52pt
  lente: 52, // "Anamórfica" = 43pt
  angulo: 67, // "Contra-plongée" = 58pt
  movimento: 58, // cabeçalho "MOVIMENTO" = 49pt
  reset: 44, // "completo" = 35pt ("Reset completo" quebra entre palavras)
  takes: 35, // cabeçalho "TAKES" = 26pt
  minTake: 46, // cabeçalho "MIN/TAKE" = 38pt, não quebra
  setup: 35, // cabeçalho "SETUP" = 27pt
  total: 34, // cabeçalho "TOTAL" = 25pt
} as const;

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
          // Divisória de reset + linha inteiras: só a <Tr> travada ainda deixava a linha começar no pé
          // da página e terminar na seguinte, embaixo do cabeçalho repetido.
          <View key={entry.id} style={{ width: "100%" }} wrap={false}>
            {previous && previousHasReset && (
              <SeparatorRow
                bg={isHeavyReset ? (previous.tipoReset === "RESET_COMPLETO" ? colors.dangerBg : colors.amberBg) : colors.rowAlt}
                textColor={resetDividerColor(previous.tipoReset)}
                label={`+${previous.tempoResetMin ?? 0}min ${RESET_LABEL[previous.tipoReset].toLowerCase()}`}
              />
            )}
            <Tr alt={i % 2 === 1} bg={isDetalheRow ? colors.amberBg : undefined} wrap={false}>
              <Td width={COL.cenaPlano}>
                <Text style={{ fontWeight: 700, color: filmado ? colors.success : undefined }}>
                  Cena {entry.sceneNumero} · Plano {entry.numero}
                </Text>
              </Td>
              <Td width={PRIORIDADE_COL_PT} align="center">
                {PRIORIDADE_INICIAL[entry.prioridade]}
              </Td>
              <Td flex={1}>
                <Text style={descartado ? styles.statusDescartado : undefined}>{entry.descricao}</Text>
              </Td>
              <Td width={COL.tamanho}>{entry.tamanho || "—"}</Td>
              <Td width={COL.lente}>{entry.lente || "—"}</Td>
              <Td width={COL.angulo}>{entry.angulo || "—"}</Td>
              <Td width={COL.movimento}>{entry.movimento || "—"}</Td>
              <Td width={COL.reset}>{previousHasReset ? RESET_LABEL[previous!.tipoReset] : "—"}</Td>
              <Td width={COL.takes} align="center">
                {entry.takesPrevistos}
              </Td>
              <Td width={COL.minTake} align="center">
                {entry.duracaoTakeMin}
              </Td>
              <Td width={COL.setup} align="center">
                {entry.tempoSetupMin}
              </Td>
              <Td width={COL.total} align="center">
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
      <Page size="A4" orientation="landscape" style={kit.pageV2}>
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
            <View style={styles.sceneHeader} fixed>
              <Text style={styles.sceneHeaderTitle}>Ordem de Filmagem — Diária {shootDay.numeroDia}</Text>
            </View>
            <View style={styles.sceneBody}>
              <Table>
                <Tr header dark fixed>
                  <Td width={COL.cenaPlano}>CENA · PLANO</Td>
                  <Td width={PRIORIDADE_COL_PT} align="center">
                    PRI
                  </Td>
                  <Td flex={1}>DESCRIÇÃO</Td>
                  <Td width={COL.tamanho}>TAMANHO</Td>
                  <Td width={COL.lente}>LENTE</Td>
                  <Td width={COL.angulo}>ÂNGULO</Td>
                  <Td width={COL.movimento}>MOVIMENTO</Td>
                  <Td width={COL.reset}>RESET</Td>
                  <Td width={COL.takes} align="center">
                    TAKES
                  </Td>
                  <Td width={COL.minTake} align="center">
                    MIN/TAKE
                  </Td>
                  <Td width={COL.setup} align="center">
                    SETUP
                  </Td>
                  <Td width={COL.total} align="center">
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
                // A cena pode quebrar entre páginas — travada (wrap={false}), uma cena maior que a
                // página era desenhada por cima do resto (~15 planos já bastavam). Cabeçalho da cena e
                // dos campos se repetem (`fixed`) no topo de cada página em que ela continua; cada
                // linha de plano continua inteira.
                <Fragment key={scene.sceneId}>
                  {/* Cena só começa no pé da página se couber cabeçalho + sinopse + a primeira linha
                      de plano no pior caso (notas longas ≈ 150pt); senão vai inteira pra próxima.
                      Espaçador vazio: minPresenceAhead não age em elemento `fixed`. */}
                  <View minPresenceAhead={240} />
                  <View style={styles.sceneSection}>
                    <View style={styles.sceneHeader} fixed>
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
                          <Tr header dark fixed>
                            <Td width={COL.ordem}>Nº</Td>
                            <Td width={PRIORIDADE_COL_PT} align="center">
                              PRI
                            </Td>
                            <Td flex={2}>DESCRIÇÃO</Td>
                            <Td width={COL.tamanho}>TAMANHO</Td>
                            <Td width={COL.lente}>LENTE</Td>
                            <Td width={COL.angulo}>ÂNGULO</Td>
                            <Td width={COL.movimento}>MOVIMENTO</Td>
                            <Td width={COL.reset}>RESET</Td>
                            <Td width={COL.takes} align="center">
                              TAKES
                            </Td>
                            <Td width={COL.minTake} align="center">
                              MIN/TAKE
                            </Td>
                            <Td width={COL.setup} align="center">
                              SETUP
                            </Td>
                            <Td width={COL.total} align="center">
                              TOTAL
                            </Td>
                            <Td flex={1}>NOTAS DIR.</Td>
                            <Td flex={1}>NOTAS CONT.</Td>
                          </Tr>
                          {scene.shots.map((shot, i) => {
                            const isHeavyReset = i > 0 && HEAVY_RESETS.includes(shot.tipoReset);
                            const isDetalheRow = isDetalheOuInsert(shot.tamanho);
                            const filmado = shot.status === "FILMADO";
                            const descartado = shot.status === "DESCARTADO";
                            const hasReset = i > 0 && shot.tipoReset !== "NENHUM" && shot.tipoReset !== "AJUSTE";

                            return (
                              <View key={shot.id} style={{ width: "100%" }} wrap={false}>
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
                                  <Td width={COL.ordem}>
                                    <Text style={filmado ? { color: colors.success, fontWeight: 700 } : undefined}>
                                      {shot.ordem}
                                    </Text>
                                  </Td>
                                  <Td width={PRIORIDADE_COL_PT} align="center">
                                    {PRIORIDADE_INICIAL[shot.prioridade]}
                                  </Td>
                                  <Td flex={2}>
                                    <Text style={descartado ? styles.statusDescartado : undefined}>
                                      {shot.descricao}
                                    </Text>
                                  </Td>
                                  <Td width={COL.tamanho}>{shot.tamanho || "—"}</Td>
                                  <Td width={COL.lente}>{shot.lente || "—"}</Td>
                                  <Td width={COL.angulo}>{shot.angulo || "—"}</Td>
                                  <Td width={COL.movimento}>{shot.movimento || "—"}</Td>
                                  <Td width={COL.reset}>
                                    {shot.tipoReset !== "NENHUM" ? RESET_LABEL[shot.tipoReset] : "—"}
                                  </Td>
                                  <Td width={COL.takes} align="center">
                                    {shot.takesPrevistos}
                                  </Td>
                                  <Td width={COL.minTake} align="center">
                                    {shot.duracaoTakeMin}
                                  </Td>
                                  <Td width={COL.setup} align="center">
                                    {shot.tempoSetupMin}
                                  </Td>
                                  <Td width={COL.total} align="center">
                                    {shot.tempoTotalMin}
                                  </Td>
                                  <Td flex={1}>{shot.notasDirecao || "—"}</Td>
                                  <Td flex={1}>{shot.notasContinuidade || "—"}</Td>
                                </Tr>
                              </View>
                            );
                          })}
                        </Table>
                      )}
                    </View>
                  </View>
                </Fragment>
              );
            })}
          </>
        )}

        <StandardFooter projectTitulo={project.titulo} documentName="Lista de Planos" />
      </Page>
    </Document>
  );
}
