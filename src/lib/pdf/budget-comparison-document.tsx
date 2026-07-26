import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { BudgetData } from "@/components/budget/types";
import { ACCOUNT_GROUP_TYPE_LABEL } from "@/components/budget/types";
import {
  computeScenarioTotals,
  formatCurrency,
  resolveScenarioGlobalValues,
} from "@/lib/budget-calc";
import { colors, kit, SectionTitle, Table, Td, Tr } from "@/lib/pdf/kit";

const styles = StyleSheet.create({
  cover: { flex: 1, alignItems: "center", justifyContent: "center" },
  coverTitle: { fontSize: 18, fontWeight: 700, textAlign: "center", marginBottom: 8 },
  coverSub: { fontSize: 10, color: colors.muted, textAlign: "center" },
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
  section: { marginBottom: 12 },
});

function Footer({ projectTitulo }: { projectTitulo: string }) {
  return (
    <Text
      style={styles.footer}
      fixed
      render={({ pageNumber, totalPages }) => `${projectTitulo} · página ${pageNumber} de ${totalPages}`}
    />
  );
}

export function BudgetComparisonDocument({
  budget,
  projectTitulo,
}: {
  budget: BudgetData;
  projectTitulo: string;
}) {
  const scenarios = [...budget.scenarios].sort((a, b) => {
    if (a.isBase !== b.isBase) return a.isBase ? -1 : 1;
    return a.nome.localeCompare(b.nome);
  });

  const totalsByScenario = new Map(
    scenarios.map((s) => [
      s.id,
      computeScenarioTotals({
        accountGroups: budget.accountGroups,
        fringes: budget.fringes,
        contingenciaPercentual: budget.contingenciaPercentual,
        globalValues: resolveScenarioGlobalValues(budget, s),
      }),
    ])
  );

  const baseScenario = scenarios.find((s) => s.isBase);
  const baseTotals = baseScenario ? totalsByScenario.get(baseScenario.id) : undefined;

  const labelWidth = 28;
  const colWidth = (100 - labelWidth) / Math.max(scenarios.length, 1);

  const allGlobalKeys = [...new Set(budget.globals.map((g) => g.chave))];

  function totalRow(
    label: string,
    field: "totalATL" | "totalBTL" | "totalFringes" | "contingencia" | "grandTotal",
    bold?: boolean
  ) {
    return (
      <Tr key={field}>
        <Td width={`${labelWidth}%`} bold={bold}>
          {label}
        </Td>
        {scenarios.map((scenario) => {
          const value = totalsByScenario.get(scenario.id)![field];
          const baseValue = baseTotals?.[field] ?? 0;
          const differs = !scenario.isBase && value !== baseValue;
          return (
            <Td key={scenario.id} width={`${colWidth}%`} align="right" bold={bold || differs}>
              <Text style={differs ? { color: colors.danger } : undefined}>
                {formatCurrency(value, budget.moedaBase)}
              </Text>
            </Td>
          );
        })}
      </Tr>
    );
  }

  return (
    <Document>
      <Page size="A4" style={kit.page}>
        <View style={styles.cover}>
          <Text style={styles.coverTitle}>Comparação de Cenários</Text>
          <Text style={styles.coverSub}>{projectTitulo}</Text>
          <Text style={styles.coverSub}>{scenarios.length} cenários · Gerado em {new Date().toLocaleDateString("pt-BR")}</Text>
        </View>
        <Footer projectTitulo={projectTitulo} />
      </Page>

      <Page size="A4" style={kit.page}>
        <View style={styles.section}>
          <SectionTitle>TOTAIS POR GRUPO</SectionTitle>
          <Table>
            <Tr header>
              <Td width={`${labelWidth}%`} bold>
                Grupo
              </Td>
              {scenarios.map((s) => (
                <Td key={s.id} width={`${colWidth}%`} bold align="right">
                  {s.nome}
                  {s.isBase ? " (base)" : ""}
                </Td>
              ))}
            </Tr>
            {budget.accountGroups.map((group) => (
              <Tr key={group.id}>
                <Td width={`${labelWidth}%`}>
                  {group.codigo} — {ACCOUNT_GROUP_TYPE_LABEL[group.tipo]}
                </Td>
                {scenarios.map((scenario) => {
                  const value = totalsByScenario.get(scenario.id)!.groupTotals.get(group.id) ?? 0;
                  const baseValue = baseTotals?.groupTotals.get(group.id) ?? 0;
                  const differs = !scenario.isBase && value !== baseValue;
                  return (
                    <Td key={scenario.id} width={`${colWidth}%`} align="right" bold={differs}>
                      <Text style={differs ? { color: colors.danger } : undefined}>
                        {formatCurrency(value, budget.moedaBase)}
                      </Text>
                    </Td>
                  );
                })}
              </Tr>
            ))}
            {totalRow("Total ATL", "totalATL")}
            {totalRow("Total BTL", "totalBTL")}
            {totalRow("Total Fringes", "totalFringes")}
            {totalRow("Contingência", "contingencia")}
            {totalRow("GRAND TOTAL", "grandTotal", true)}
          </Table>
        </View>

        <View style={styles.section}>
          <SectionTitle>Δ VS. BASE</SectionTitle>
          <Table>
            <Tr header>
              <Td width={`${labelWidth}%`} bold>
                Cenário
              </Td>
              <Td width={`${colWidth}%`} bold align="right">
                Δ Grand Total
              </Td>
            </Tr>
            {scenarios.map((scenario) => {
              const totals = totalsByScenario.get(scenario.id)!;
              const delta = baseTotals ? totals.grandTotal - baseTotals.grandTotal : 0;
              return (
                <Tr key={scenario.id}>
                  <Td width={`${labelWidth}%`}>
                    {scenario.nome}
                    {scenario.isBase ? " (base)" : ""}
                  </Td>
                  <Td width={`${colWidth}%`} align="right">
                    {scenario.isBase ? "—" : `${delta >= 0 ? "+" : ""}${formatCurrency(delta, budget.moedaBase)}`}
                  </Td>
                </Tr>
              );
            })}
          </Table>
        </View>

        {allGlobalKeys.length > 0 && (
          <View style={styles.section}>
            <SectionTitle>GLOBALS POR CENÁRIO</SectionTitle>
            <Table>
              <Tr header>
                <Td width={`${labelWidth}%`} bold>
                  Chave
                </Td>
                {scenarios.map((s) => (
                  <Td key={s.id} width={`${colWidth}%`} bold align="center">
                    {s.nome}
                    {s.isBase ? " (base)" : ""}
                  </Td>
                ))}
              </Tr>
              {allGlobalKeys.map((chave) => {
                const baseValue = budget.globals.find((g) => g.chave === chave)?.valor ?? 0;
                return (
                  <Tr key={chave}>
                    <Td width={`${labelWidth}%`}>{chave}</Td>
                    {scenarios.map((scenario) => {
                      const globalValues = resolveScenarioGlobalValues(budget, scenario);
                      const value = globalValues.get(chave) ?? 0;
                      const differs = !scenario.isBase && value !== baseValue;
                      return (
                        <Td key={scenario.id} width={`${colWidth}%`} align="center" bold={differs}>
                          <Text style={differs ? { color: colors.danger } : undefined}>{value}</Text>
                        </Td>
                      );
                    })}
                  </Tr>
                );
              })}
            </Table>
          </View>
        )}

        <Footer projectTitulo={projectTitulo} />
      </Page>
    </Document>
  );
}
