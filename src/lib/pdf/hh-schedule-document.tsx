import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatFullDate, weekdayNameFull } from "@/lib/calendar-grid";
import { getCharacterId } from "@/lib/character-id";
import { formatPaginas, formatTempoEstimado } from "@/lib/paginas";
import { colors, DocHeader, kit, SectionTitle, SeparatorRow, Table, Td, TimeRangeCell, Tr } from "@/lib/pdf/kit";
import type { ShootDayReportData } from "@/lib/report-data";
import { formatHHh } from "@/lib/schedule";
import { HEAVY_RESETS, PRIORIDADE_INICIAL, RESET_LABEL } from "@/lib/shots-shared";
import type { ShotTipoReset } from "@prisma/client";

const styles = StyleSheet.create({
  section: { marginBottom: 10 },
  footer: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.headerBg,
    paddingTop: 6,
    textAlign: "center",
    fontSize: 8.5,
    fontWeight: 700,
  },
  sceneObsText: { fontSize: 7, fontStyle: "italic", color: colors.muted },
});

// Larguras em PONTOS, medidas pelo pior valor em Helvetica 8.5 + 8pt de padding da célula — mesma
// régua da Ordem do Dia (call-sheet-document.tsx). Porcentagem dimensionada pelo caso médio fazia
// ENTARDECER quebrar em "EN-TARDE-CER" por cima de Set/Locação. Set/Locação e Sinopse dividem o
// que sobra (A4 com kit.page = 543pt úteis).
const COL = {
  horario: 36, // "10h15" em 7pt = 20pt; cabeçalho "HH Prep" quebra em duas linhas
  // "102APL" = 30pt; parte de cena dividida vem junto ("102APL · Continuação do dublê voice off") e
  // quebra entre palavras — "Continuação" (45pt) é a palavra longa típica de rótulo e cabe inteira.
  cena: 64,
  tipo: 42, // "INT/EXT" = 33pt
  periodo: 68, // "ENTARDECER" = 59pt, a palavra mais longa dos períodos
  elenco: 68, // 3 IDs por linha
  paginas: 34, // "12 7/8" = 24pt
  diaNarrativo: 34, // "Dia 88" = 24pt; cabeçalho "Dia Narr." quebra em duas linhas
  filmagem: 50, // cabeçalho "Filmagem" em negrito 8.5 = 40pt
} as const;

/** Correção 1: NENHUM/AJUSTE não têm divisória; TROCA_LENTE/TROCA_CAMERA usam cinza neutro;
 *  RESET_POSICAO usa âmbar; RESET_COMPLETO usa vermelho/perigo — mesma lógica do Call Sheet
 *  (call-sheet-document.tsx), adaptada à paleta legado (colors.muted) deste documento. */
function resetDividerColor(tipoReset: ShotTipoReset): string {
  if (tipoReset === "RESET_COMPLETO") return colors.danger;
  if (tipoReset === "RESET_POSICAO") return colors.amber;
  return colors.muted;
}

function SceneRow({
  scene,
  project,
}: {
  scene: ShootDayReportData["scenes"][number];
  project: ShootDayReportData["project"];
}) {
  return (
    <Tr>
      <TimeRangeCell
        width={COL.horario}
        start={scene.schedule ? formatHHh(scene.schedule.prepStart) : null}
        end={scene.schedule ? formatHHh(scene.schedule.prepEnd) : null}
      />
      <TimeRangeCell
        width={COL.horario}
        start={scene.schedule ? formatHHh(scene.schedule.rodStart) : null}
        end={scene.schedule ? formatHHh(scene.schedule.rodEnd) : null}
      />
      <Td width={COL.cena}>{scene.numero}</Td>
      <Td width={COL.tipo}>{scene.tipo ?? "—"}</Td>
      <Td width={COL.periodo}>{scene.periodo ?? "—"}</Td>
      <Td flex={2}>{scene.setLocacaoDisplay}</Td>
      <Td flex={3}>{scene.sinopse || "—"}</Td>
      <Td width={COL.elenco}>{scene.cast.map((c) => getCharacterId(c, project)).join(", ") || "—"}</Td>
      <Td width={COL.paginas} align="right">
        {formatPaginas(scene.paginas)}
      </Td>
      <Td width={COL.diaNarrativo} align="center">
        {scene.diaNarrativo != null ? `Dia ${scene.diaNarrativo}` : "—"}
      </Td>
      <Td width={COL.filmagem} align="center">
        {scene.tempoEstimadoMin != null ? formatTempoEstimado(scene.tempoEstimadoMin) : "—"}
      </Td>
    </Tr>
  );
}

/** Sub-linha com a nota operacional da diária (SceneShootDay.observacoes) logo abaixo de <SceneRow>,
 *  antes dos planos — mesmo tratamento do Call Sheet (ver call-sheet-document.tsx). [] quando vazia. */
function SceneObservacoesRow({ scene }: { scene: ShootDayReportData["scenes"][number] }) {
  if (!scene.observacoes) return null;

  return (
    <Tr wrap={false}>
      <Td width={COL.horario * 2} />
      <Td flex={1}>
        <Text style={styles.sceneObsText}>Obs.: {scene.observacoes}</Text>
      </Td>
    </Tr>
  );
}

/** Sub-linhas de plano/reset logo abaixo de cada <SceneRow>, indentadas sob as colunas de horário
 *  (HH Prep + HH Rod = COL.horario × 2). Mesmo tratamento visual do Call Sheet (ver call-sheet-document.tsx),
 *  adaptado à paleta legado (kit.page/colors) usada neste documento. [] quando a cena não tem planos. */
function ShotSubRows({ scene }: { scene: ShootDayReportData["scenes"][number] }) {
  if (scene.shots.length === 0) return null;

  return (
    <>
      {scene.shots.map((shot, i) => {
        const isHeavyReset = i > 0 && HEAVY_RESETS.includes(shot.tipoReset);
        const filmado = shot.status === "FILMADO";
        const descartado = shot.status === "DESCARTADO";

        return (
          <View key={shot.id} style={{ width: "100%" }}>
            {i > 0 && shot.tipoReset !== "NENHUM" && shot.tipoReset !== "AJUSTE" && (
              <Tr bg={colors.rowAlt} wrap={false}>
                <Td width={COL.horario * 2} />
                <Td flex={1}>
                  <Text style={{ fontSize: 7, color: resetDividerColor(shot.tipoReset) }}>
                    +{shot.tempoResetMin ?? 0}min {RESET_LABEL[shot.tipoReset].toLowerCase()}
                  </Text>
                </Td>
              </Tr>
            )}
            <Tr
              bg={
                shot.tipoReset === "RESET_COMPLETO"
                  ? colors.dangerBg
                  : isHeavyReset
                    ? colors.amberBg
                    : undefined
              }
              wrap={false}
            >
              <Td width={COL.horario * 2} />
              <Td flex={1}>
                <Text
                  style={{
                    fontSize: 7,
                    color: descartado ? colors.muted : filmado ? colors.success : colors.text,
                    textDecoration: descartado ? "line-through" : undefined,
                  }}
                >
                  » {shot.ordem}. [{PRIORIDADE_INICIAL[shot.prioridade]}] {shot.tamanho || "—"} · {shot.lente || "—"} · {shot.movimento || "—"} ·{" "}
                  {shot.tempoTotalMin}min ({shot.takesPrevistos}T)
                </Text>
              </Td>
            </Tr>
          </View>
        );
      })}
    </>
  );
}

export function HHScheduleDocument({ data }: { data: ShootDayReportData }) {
  const { project, shootDay, totalShootDays, manhaScenes, tardeScenes, totalPaginas } = data;

  return (
    <Document>
      <Page size="A4" style={kit.page}>
        <DocHeader
          projectTitulo={project.titulo}
          diretor={project.diretor}
          producao={project.producao}
          numeroDia={shootDay.numeroDia}
          totalShootDays={totalShootDays}
          weekday={weekdayNameFull(shootDay.data)}
          fullDate={formatFullDate(shootDay.data)}
        />

        <View style={styles.section}>
          <SectionTitle>PLANO DE FILMAGEM</SectionTitle>
          <Table>
            <Tr header>
              <Td width={COL.horario} bold align="center">
                HH Prep
              </Td>
              <Td width={COL.horario} bold align="center">
                HH Rod
              </Td>
              <Td width={COL.cena} bold>
                Cena
              </Td>
              <Td width={COL.tipo} bold>
                INT/EXT
              </Td>
              <Td width={COL.periodo} bold>
                D/N
              </Td>
              <Td flex={2} bold>
                Set / Locação
              </Td>
              <Td flex={3} bold>
                Sinopse
              </Td>
              <Td width={COL.elenco} bold>
                Elenco
              </Td>
              <Td width={COL.paginas} bold align="right">
                Págs
              </Td>
              <Td width={COL.diaNarrativo} bold align="center">
                Dia Narr.
              </Td>
              <Td width={COL.filmagem} bold align="center">
                Filmagem
              </Td>
            </Tr>
            {manhaScenes.map((scene) => (
              <View key={scene.sceneId} style={{ width: "100%" }}>
                <SceneRow scene={scene} project={project} />
                <SceneObservacoesRow scene={scene} />
                <ShotSubRows scene={scene} />
              </View>
            ))}
            {(shootDay.almocoInicio || tardeScenes.length > 0) && (
              <SeparatorRow
                label={`ALMOÇO${shootDay.almocoInicio ? ` — ${formatHHh(shootDay.almocoInicio)}` : ""}${
                  shootDay.almocoFim ? ` às ${formatHHh(shootDay.almocoFim)}` : ""
                }`}
              />
            )}
            {tardeScenes.map((scene) => (
              <View key={scene.sceneId} style={{ width: "100%" }}>
                <SceneRow scene={scene} project={project} />
                <SceneObservacoesRow scene={scene} />
                <ShotSubRows scene={scene} />
              </View>
            ))}
            {shootDay.desprodInicio && <SeparatorRow label={`DESPRODUÇÃO — ${formatHHh(shootDay.desprodInicio)}`} />}
          </Table>
        </View>

        <Text style={styles.footer}>
          End of Shooting Day {shootDay.numeroDia} — {weekdayNameFull(shootDay.data)},{" "}
          {formatFullDate(shootDay.data)} — Total Pages: {formatPaginas(totalPaginas)}
        </Text>
      </Page>
    </Document>
  );
}
