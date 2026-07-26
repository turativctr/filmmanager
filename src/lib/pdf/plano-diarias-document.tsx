import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { PlanoSimplesData } from "@/lib/ad-documents-data";
import { MONTH_NAMES } from "@/lib/calendar-grid";
import { colors, kit, StandardFooter } from "@/lib/pdf/kit";

const styles = StyleSheet.create({
  page: { ...kit.pageV2, fontSize: 11 },
  headerBlock: { alignItems: "center", marginBottom: 16 },
  headerTitle: { fontSize: 12, fontWeight: 700, textTransform: "uppercase" },
  headerDates: { fontSize: 11, fontWeight: 700, marginTop: 3 },
  headerProject: { fontSize: 22, fontWeight: 700, marginTop: 10 },
  headerDiretor: { fontSize: 11, color: colors.medGray, marginTop: 3 },
  dayBlock: { marginBottom: 6 },
  badgeRow: { flexDirection: "row", marginBottom: 6 },
  badge: { backgroundColor: "#FFEB3B", borderRadius: 3, paddingVertical: 3, paddingHorizontal: 9 },
  badgeText: { fontSize: 11, fontWeight: 700, color: colors.black },
  line: { marginBottom: 3 },
  ruleOuter: { width: "100%", marginTop: 10, marginBottom: 10, borderBottomWidth: 1.2, borderBottomColor: colors.black },
  ruleInner: { width: "100%", borderBottomWidth: 0.6, borderBottomColor: colors.black },
});

/** "08, 13 E 15 DE MAIO" — agrupa por mês; múltiplos meses viram grupos separados por "; ". */
function formatDiasHeader(dates: Date[]): string {
  const byMonth = new Map<number, Set<number>>();
  for (const d of dates) {
    const month = d.getUTCMonth();
    const set = byMonth.get(month) ?? new Set<number>();
    set.add(d.getUTCDate());
    byMonth.set(month, set);
  }
  const groups = [...byMonth.entries()]
    .sort(([a], [b]) => a - b)
    .map(([month, daySet]) => {
      const days = [...daySet].sort((a, b) => a - b).map((d) => String(d).padStart(2, "0"));
      const joined = days.length === 1 ? days[0] : `${days.slice(0, -1).join(", ")} E ${days[days.length - 1]}`;
      return `${joined} DE ${MONTH_NAMES[month].toUpperCase()}`;
    });
  return groups.join("; ");
}

/** "Cenas X" · "Cenas X e Y" · "Cenas X, Y e Z" — lista narrativa em vez de vírgulas simples, ver spec. */
function formatScenesLine(numbers: string[]): string {
  if (numbers.length === 0) return "nenhuma cena definida ainda";
  if (numbers.length === 1) return `Cenas ${numbers[0]}`;
  return `Cenas ${numbers.slice(0, -1).join(", ")} e ${numbers[numbers.length - 1]}`;
}

function formatDDMM(date: Date): string {
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function PlanoDiariasDocument({ data }: { data: PlanoSimplesData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBlock}>
          <Text style={styles.headerTitle}>Plano de Filmagens para os Dias</Text>
          {data.days.length > 0 && (
            <Text style={styles.headerDates}>{formatDiasHeader(data.days.map((d) => d.data))}</Text>
          )}
          <Text style={styles.headerProject}>{data.titulo}</Text>
          {data.diretor && <Text style={styles.headerDiretor}>Direção: {data.diretor}</Text>}
        </View>

        {data.days.length === 0 && <Text>Nenhuma diária cadastrada ainda.</Text>}

        {data.days.map((day, i) => (
          <View key={day.shootDayId} wrap={false}>
            <View style={styles.dayBlock}>
              <View style={styles.badgeRow}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>PARA DIA {formatDDMM(day.data)}:</Text>
                </View>
              </View>
              <Text style={styles.line}>Local: {day.locacaoNome || "a definir"}</Text>
              <Text style={styles.line}>Endereço: {day.locacaoEndereco || "a definir"}</Text>
              {day.observacao && <Text style={styles.line}>{day.observacao}</Text>}
              <Text style={styles.line}>
                Cenas que vamos gravar: {formatScenesLine(day.scenesNumeros)}
                {day.setsDescricao ? ` (${day.setsDescricao})` : ""}
              </Text>
            </View>
            {i < data.days.length - 1 && (
              <View>
                <View style={styles.ruleOuter} />
                <View style={styles.ruleInner} />
              </View>
            )}
          </View>
        ))}

        <StandardFooter projectTitulo={data.titulo} documentName="Plano Simplificado para as Diárias" />
      </Page>
    </Document>
  );
}
