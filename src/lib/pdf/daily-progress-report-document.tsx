import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { DailyProgressReportData } from "@/lib/ad-documents-data";
import { formatFullDate, weekdayNameFull } from "@/lib/calendar-grid";
import { colors, kit, KeyValue, SectionTitle, StandardFooter, StandardHeader } from "@/lib/pdf/kit";

const styles = StyleSheet.create({
  dateLine: { fontSize: 9, color: colors.medGray, marginBottom: 12 },
  statsRow: { flexDirection: "row", marginBottom: 10 },
  statBox: { flex: 1, borderWidth: 0.75, borderColor: colors.borderV2, padding: 6, marginRight: 6 },
  statLabel: { fontSize: 7, color: colors.medGray, textTransform: "uppercase" },
  statValue: { fontSize: 14, fontWeight: 700, marginTop: 2 },
  sceneChip: {
    fontSize: 7.5,
    borderWidth: 0.5,
    borderColor: colors.borderV2,
    paddingVertical: 1.5,
    paddingHorizontal: 4,
    marginRight: 3,
    marginBottom: 3,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 },
});

export function DailyProgressReportDocument({ data }: { data: DailyProgressReportData }) {
  const { shootDay, report } = data;

  return (
    <Document>
      <Page size="A4" style={kit.pageV2}>
        <StandardHeader
          projectTitulo={data.titulo}
          diretor={data.diretor}
          producao={data.producao}
          documentTitle={`Daily Progress Report — Diária ${shootDay.numeroDia}`}
        />
        <Text style={styles.dateLine}>
          {weekdayNameFull(shootDay.data)}, {formatFullDate(shootDay.data)}
        </Text>

        {!report ? (
          <Text style={kit.muted}>Relatório ainda não preenchido para esta diária.</Text>
        ) : (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Cenas concluídas</Text>
                <Text style={styles.statValue}>{report.cenasConcluidas.length}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Cenas não concluídas</Text>
                <Text style={styles.statValue}>{report.cenasNaoConcluidas.length}</Text>
              </View>
              <View style={{ ...styles.statBox, marginRight: 0 }}>
                <Text style={styles.statLabel}>Páginas filmadas</Text>
                <Text style={styles.statValue}>{report.paginasFilmadas}</Text>
              </View>
            </View>

            <SectionTitle>Cenas concluídas</SectionTitle>
            <View style={styles.chipRow}>
              {report.cenasConcluidas.length === 0 ? (
                <Text style={kit.muted}>Nenhuma.</Text>
              ) : (
                report.cenasConcluidas.map((n) => (
                  <Text key={n} style={styles.sceneChip}>
                    {n}
                  </Text>
                ))
              )}
            </View>

            <SectionTitle>Cenas não concluídas (remanejadas)</SectionTitle>
            <View style={styles.chipRow}>
              {report.cenasNaoConcluidas.length === 0 ? (
                <Text style={kit.muted}>Nenhuma — todas as cenas previstas foram concluídas.</Text>
              ) : (
                report.cenasNaoConcluidas.map((n) => (
                  <Text key={n} style={styles.sceneChip}>
                    {n}
                  </Text>
                ))
              )}
            </View>

            <SectionTitle>Horários e atraso</SectionTitle>
            <KeyValue label="Início real" value={report.horaInicioReal} />
            <KeyValue label="Término real" value={report.horaTerminoReal} />
            <KeyValue label="Atraso (min)" value={report.atrasoMin != null ? String(report.atrasoMin) : null} />
            <KeyValue label="Motivo do atraso" value={report.motivoAtraso} />

            <View style={{ marginTop: 8 }}>
              <SectionTitle>Observações</SectionTitle>
              <Text style={{ fontSize: 8 }}>{report.observacoes || "—"}</Text>
            </View>
          </>
        )}

        <StandardFooter projectTitulo={data.titulo} documentName="Daily Progress Report" />
      </Page>
    </Document>
  );
}
