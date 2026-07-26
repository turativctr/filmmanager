import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatFullDate, weekdayNameFull } from "@/lib/calendar-grid";
import { getCharacterId } from "@/lib/character-id";
import { formatPaginas } from "@/lib/paginas";
import { colors, DocHeader, kit, SectionTitle, SeparatorRow, Table, Td, TimeRangeCell, Tr } from "@/lib/pdf/kit";
import type { ShootDayReportData } from "@/lib/report-data";
import { formatHHh } from "@/lib/schedule";
import { HEAVY_RESETS, RESET_LABEL } from "@/lib/shots-shared";
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
        width="10%"
        start={scene.schedule ? formatHHh(scene.schedule.prepStart) : null}
        end={scene.schedule ? formatHHh(scene.schedule.prepEnd) : null}
      />
      <TimeRangeCell
        width="10%"
        start={scene.schedule ? formatHHh(scene.schedule.rodStart) : null}
        end={scene.schedule ? formatHHh(scene.schedule.rodEnd) : null}
      />
      <Td width="5%">{scene.numero}</Td>
      <Td width="8%">{scene.tipo ?? "—"}</Td>
      <Td width="5%">{scene.periodo ?? "—"}</Td>
      <Td width="14%">{scene.setLocacaoDisplay}</Td>
      <Td width="23%">{scene.sinopse || "—"}</Td>
      <Td width="9%">{scene.cast.map((c) => getCharacterId(c, project)).join(", ") || "—"}</Td>
      <Td width="5%" align="right">
        {formatPaginas(scene.paginas)}
      </Td>
      <Td width="5%" align="center">
        {scene.diaNarrativo != null ? `Dia ${scene.diaNarrativo}` : "—"}
      </Td>
      <Td width="6%" align="center">
        {scene.tempoEstimadoMin ?? "—"}
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
      <Td width="20%" />
      <Td width="80%">
        <Text style={styles.sceneObsText}>Obs.: {scene.observacoes}</Text>
      </Td>
    </Tr>
  );
}

/** Sub-linhas de plano/reset logo abaixo de cada <SceneRow>, indentadas sob as colunas de horário
 *  (HH Prep + HH Rod = 20% de largura). Mesmo tratamento visual do Call Sheet (ver call-sheet-document.tsx),
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
                <Td width="20%" />
                <Td width="80%">
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
              <Td width="20%" />
              <Td width="80%">
                <Text
                  style={{
                    fontSize: 7,
                    color: descartado ? colors.muted : filmado ? colors.success : colors.text,
                    textDecoration: descartado ? "line-through" : undefined,
                  }}
                >
                  » {shot.ordem}. {shot.tamanho || "—"} · {shot.lente || "—"} · {shot.movimento || "—"} ·{" "}
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
              <Td width="10%" bold align="center">
                HH Prep
              </Td>
              <Td width="10%" bold align="center">
                HH Rod
              </Td>
              <Td width="5%" bold>
                Cena
              </Td>
              <Td width="8%" bold>
                INT/EXT
              </Td>
              <Td width="5%" bold>
                D/N
              </Td>
              <Td width="14%" bold>
                Set / Locação
              </Td>
              <Td width="23%" bold>
                Sinopse
              </Td>
              <Td width="9%" bold>
                Elenco
              </Td>
              <Td width="5%" bold align="right">
                Págs
              </Td>
              <Td width="5%" bold align="center">
                Dia Narr.
              </Td>
              <Td width="6%" bold align="center">
                Est. min
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
