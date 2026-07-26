import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { WeeklyPlanData } from "@/lib/ad-documents-data";
import { formatFullDate, weekdayNameFull } from "@/lib/calendar-grid";
import { formatPaginas } from "@/lib/paginas";
import { colors, kit, StandardFooter, StandardHeader, Table, Td, Tr } from "@/lib/pdf/kit";

const styles = StyleSheet.create({
  weekLabel: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.black,
  },
  daySection: { marginBottom: 12, borderWidth: 0.75, borderColor: colors.borderV2 },
  dayHeader: { backgroundColor: colors.tableHeaderBg, padding: 5 },
  dayTitle: { fontSize: 9, fontWeight: 700, color: "#ffffff" },
  dayTotais: { fontSize: 7.5, color: colors.medGray, marginTop: 3, marginBottom: 6 },
  dayBody: { padding: 5 },
  castFooter: { fontSize: 7.5, color: colors.medGray, marginTop: 3 },
});

export function WeeklyPlanDocument({ data }: { data: WeeklyPlanData }) {
  return (
    <Document>
      <Page size="A4" style={kit.pageV2}>
        <StandardHeader
          projectTitulo={data.titulo}
          diretor={data.diretor}
          producao={data.producao}
          documentTitle="Plano Semanal de Filmagem"
        />

        {data.weeks.length === 0 && <Text style={kit.muted}>Nenhuma diária cadastrada ainda.</Text>}

        {data.weeks.map((week, i) => (
          <View key={i} wrap={false}>
            <Text style={styles.weekLabel}>Semana de {formatFullDate(week.weekStart)}</Text>
            {week.days.map((day) => {
              const totalPaginas = day.cenas.reduce((sum, c) => sum + c.paginas, 0);
              const totalMin = day.cenas.reduce((sum, c) => sum + (c.tempoEstimadoMin ?? 0), 0);
              return (
                <View key={day.numeroDia} style={styles.daySection}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayTitle}>
                      Diária {day.numeroDia} — {day.locacaoNome || "locação não definida"} · {weekdayNameFull(day.data)},{" "}
                      {formatFullDate(day.data)}
                    </Text>
                  </View>
                  <View style={styles.dayBody}>
                    <Text style={styles.dayTotais}>
                      {day.cenas.length} cena{day.cenas.length === 1 ? "" : "s"} · {formatPaginas(totalPaginas)} oitavas
                      · {totalMin} min estimados
                    </Text>
                    <Table>
                      <Tr header dark>
                        <Td width="10%">CENA</Td>
                        <Td width="43%">SINOPSE</Td>
                        <Td width="20%">ELENCO</Td>
                        <Td width="12%" align="right">
                          PÁGS
                        </Td>
                        <Td width="15%" align="right">
                          MIN
                        </Td>
                      </Tr>
                      {day.cenas.map((cena, idx) => (
                        <Tr key={cena.numero} alt={idx % 2 === 1}>
                          <Td width="10%" bold>
                            {cena.numero}
                          </Td>
                          <Td width="43%">{cena.sinopse || "—"}</Td>
                          <Td width="20%">{cena.elenco.join(", ") || "—"}</Td>
                          <Td width="12%" align="right">
                            {formatPaginas(cena.paginas)}
                          </Td>
                          <Td width="15%" align="right">
                            {cena.tempoEstimadoMin ?? "—"}
                          </Td>
                        </Tr>
                      ))}
                    </Table>
                    {day.elenco.length > 0 && (
                      <Text style={styles.castFooter}>Elenco do dia: {day.elenco.join(", ")}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ))}

        <StandardFooter projectTitulo={data.titulo} documentName="Plano Semanal de Filmagem" />
      </Page>
    </Document>
  );
}
