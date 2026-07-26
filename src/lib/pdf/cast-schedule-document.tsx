import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { CastScheduleData, CastScheduleSetGroup } from "@/lib/ad-documents-data";
import { formatFullDate, weekdayNameFull } from "@/lib/calendar-grid";
import { CastLegend, colors, kit, periodoAbrev, StandardFooter, StandardHeader, Table, Td, Tr } from "@/lib/pdf/kit";
import { formatHHhOrDash } from "@/lib/schedule";

const styles = StyleSheet.create({
  daySection: { marginBottom: 12, borderWidth: 0.75, borderColor: colors.borderV2 },
  dayHeader: { backgroundColor: colors.tableHeaderBg, padding: 5 },
  dayTitle: { fontSize: 10, fontWeight: 700, color: "#ffffff" },
  dayBody: { padding: 6 },
  dayInfoLine: { fontSize: 8.5, marginBottom: 2 },
  twoColRow: { flexDirection: "row", marginTop: 6 },
  leftCol: { width: "56%", marginRight: 8 },
  rightCol: { width: "44%" },
  colLabel: { fontSize: 8, fontWeight: 700, color: colors.medGray, marginBottom: 3 },
  setGroupLabel: { fontSize: 8, fontWeight: 700, marginTop: 4, marginBottom: 2 },
  footnote: { fontSize: 7.5, color: colors.medGray, marginTop: 6, fontStyle: "italic" },
  aDefinir: { color: colors.medGray, fontStyle: "italic" },
});

function SceneStripGroup({ group, showSetLabel }: { group: CastScheduleSetGroup; showSetLabel: boolean }) {
  return (
    <View wrap={false}>
      {showSetLabel && <Text style={styles.setGroupLabel}>{group.set}</Text>}
      <Table>
        <Tr header dark>
          <Td width="12%">Nº</Td>
          <Td width="15%">INT/EXT</Td>
          <Td width="10%">D/N</Td>
          <Td width="40%">SINOPSE</Td>
          <Td width="23%">ELENCO</Td>
        </Tr>
        {group.scenes.map((scene, i) => (
          <Tr key={scene.numero} alt={i % 2 === 1}>
            <Td width="12%" bold>
              {scene.numero}
            </Td>
            <Td width="15%">{scene.tipo ?? "—"}</Td>
            <Td width="10%">{periodoAbrev(scene.periodo)}</Td>
            <Td width="40%">{scene.sinopse || "—"}</Td>
            <Td width="23%">{scene.personagens.join(", ") || "—"}</Td>
          </Tr>
        ))}
      </Table>
    </View>
  );
}

export function CastScheduleDocument({ data }: { data: CastScheduleData }) {
  return (
    <Document>
      <Page size="A4" style={kit.pageV2}>
        <StandardHeader
          projectTitulo={data.titulo}
          diretor={data.diretor}
          producao={data.producao}
          documentTitle="Cronograma de Elenco"
        />

        <CastLegend entries={data.legend} />

        {data.days.length === 0 && <Text style={kit.muted}>Nenhuma diária cadastrada ainda.</Text>}

        {data.days.map((day) => (
          <View key={day.shootDayId} style={styles.daySection}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>
                {day.locacaoNome || "Locação não definida"} — {formatFullDate(day.data)} ({weekdayNameFull(day.data)})
              </Text>
            </View>
            <View style={styles.dayBody}>
              <Text style={styles.dayInfoLine}>Endereço: {day.locacaoEndereco || "—"}</Text>
              <Text style={styles.dayInfoLine}>
                Intervalo de horário: {formatHHhOrDash(day.chamadaGeral)} às {formatHHhOrDash(day.desprodInicio)}
              </Text>

              <View style={styles.twoColRow}>
                <View style={styles.leftCol}>
                  <Text style={styles.colLabel}>CENAS DO DIA</Text>
                  {day.setGroups.map((group) => (
                    <SceneStripGroup key={group.set} group={group} showSetLabel={day.setGroups.length > 1} />
                  ))}
                </View>
                <View style={styles.rightCol}>
                  <Text style={styles.colLabel}>ELENCO PRESENTE</Text>
                  <Table>
                    <Tr header dark>
                      <Td width="35%">PERSONAGEM</Td>
                      <Td width="35%">ATOR</Td>
                      <Td width="30%" align="center">
                        HORÁRIO
                      </Td>
                    </Tr>
                    {day.cast.map((c, i) => (
                      <Tr key={`${c.personagem}-${i}`} alt={i % 2 === 1}>
                        <Td width="35%">{c.personagem}</Td>
                        <Td width="35%">{c.ator || "—"}</Td>
                        <Td width="30%" align="center">
                          {c.confirmado ? (
                            `${formatHHhOrDash(c.chegada)} – ${formatHHhOrDash(c.saida)}`
                          ) : (
                            <Text style={styles.aDefinir}>A DEFINIR</Text>
                          )}
                        </Td>
                      </Tr>
                    ))}
                    {day.cast.length === 0 && (
                      <Tr>
                        <Td width="100%">Nenhum ator presente neste dia.</Td>
                      </Tr>
                    )}
                  </Table>
                </View>
              </View>

              {day.observacao && <Text style={styles.footnote}>* {day.observacao}</Text>}
            </View>
          </View>
        ))}

        <StandardFooter projectTitulo={data.titulo} documentName="Cronograma de Elenco" />
      </Page>
    </Document>
  );
}
