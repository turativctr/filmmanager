import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { BudgetData } from "@/components/budget/types";
import { colors, kit } from "@/lib/pdf/kit";
import { TopsheetSummarySection } from "@/lib/pdf/topsheet-summary";

const styles = StyleSheet.create({
  titleBlock: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1.5,
    borderBottomColor: colors.headerBg,
    paddingBottom: 6,
    marginBottom: 10,
  },
  projectTitle: { fontSize: 14, fontWeight: 700 },
  projectSub: { fontSize: 8, color: colors.muted, marginTop: 2 },
  docTitle: { fontSize: 12, fontWeight: 700 },
  footer: {
    position: "absolute",
    bottom: 14,
    left: 26,
    right: 26,
    fontSize: 7.5,
    color: colors.muted,
    textAlign: "center",
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    paddingTop: 4,
  },
});

export function TopsheetDocument({ budget, projectTitulo }: { budget: BudgetData; projectTitulo: string }) {
  const activeScenario = budget.scenarios.find((s) => s.isBase);
  const dataGeracao = new Date().toLocaleDateString("pt-BR");

  return (
    <Document>
      <Page size="A4" style={kit.page}>
        <View style={styles.titleBlock}>
          <View>
            <Text style={styles.projectTitle}>{projectTitulo}</Text>
            <Text style={styles.projectSub}>
              Versão {budget.versao} · Moeda base {budget.moedaBase} · Gerado em {dataGeracao}
            </Text>
            {activeScenario && <Text style={styles.projectSub}>Cenário ativo: {activeScenario.nome}</Text>}
          </View>
          <Text style={styles.docTitle}>Topsheet</Text>
        </View>

        <TopsheetSummarySection budget={budget} />

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) => `${projectTitulo} · página ${pageNumber} de ${totalPages}`}
        />
      </Page>
    </Document>
  );
}
