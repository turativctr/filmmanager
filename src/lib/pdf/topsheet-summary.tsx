import { StyleSheet, Text, View } from "@react-pdf/renderer";

import type { AccountGroupData, BudgetData } from "@/components/budget/types";
import { computeBudgetTotals, formatCurrency, isATL, sumTotals } from "@/lib/budget-calc";
import { colors, SectionTitle, Table, Td, Tr } from "@/lib/pdf/kit";

const styles = StyleSheet.create({
  section: { marginBottom: 10 },
  totalsBox: { marginTop: 12, borderWidth: 0.75, borderColor: colors.headerBg },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  totalsLabel: { fontSize: 9 },
  totalsValue: { fontSize: 9, fontWeight: 700 },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: colors.headerBg,
  },
  grandLabel: { fontSize: 11, fontWeight: 700, color: "#ffffff" },
  grandValue: { fontSize: 11, fontWeight: 700, color: "#ffffff" },
});

function groupTotal(group: AccountGroupData): number {
  return sumTotals(group.accounts.flatMap((account) => account.lineItems));
}

export function computeTopsheetTotals(budget: BudgetData) {
  const totalATL = sumTotals(
    budget.accountGroups.filter((g) => isATL(g.tipo)).flatMap((g) => g.accounts.flatMap((a) => a.lineItems))
  );
  const totalBTL = sumTotals(
    budget.accountGroups.filter((g) => !isATL(g.tipo)).flatMap((g) => g.accounts.flatMap((a) => a.lineItems))
  );
  const totalFringes = budget.fringes
    .flatMap((f) => f.fringeLineItems)
    .reduce((sum, fli) => sum + fli.valor, 0);
  return computeBudgetTotals({
    totalATL,
    totalBTL,
    totalFringes,
    contingenciaPercentual: budget.contingenciaPercentual,
  });
}

/** Tabela de resumo por grupo/conta + caixa de totais (ATL/BTL/Fringes/Contingência/Grand Total). Reaproveitado no Topsheet PDF e na última página do Orçamento Detalhado PDF. */
export function TopsheetSummarySection({ budget }: { budget: BudgetData }) {
  const totals = computeTopsheetTotals(budget);

  return (
    <>
      <View style={styles.section}>
        <SectionTitle>RESUMO POR GRUPO E CONTA</SectionTitle>
        <Table>
          <Tr header>
            <Td width="14%" bold>
              Código
            </Td>
            <Td width="66%" bold>
              Categoria / Departamento
            </Td>
            <Td width="20%" bold align="right">
              Total
            </Td>
          </Tr>
          {budget.accountGroups.map((group) => {
            const visibleAccounts = group.accounts.filter((account) => sumTotals(account.lineItems) !== 0);
            return (
              <View key={group.id}>
                <Tr>
                  <Td width="14%" bold>
                    {group.codigo}
                  </Td>
                  <Td width="66%" bold>
                    {group.nome}
                  </Td>
                  <Td width="20%" bold align="right">
                    {formatCurrency(groupTotal(group), budget.moedaBase)}
                  </Td>
                </Tr>
                {visibleAccounts.map((account) => (
                  <Tr key={account.id}>
                    <Td width="14%">{account.codigo}</Td>
                    <Td width="66%">{account.nome}</Td>
                    <Td width="20%" align="right">
                      {formatCurrency(sumTotals(account.lineItems), budget.moedaBase)}
                    </Td>
                  </Tr>
                ))}
              </View>
            );
          })}
        </Table>
      </View>

      <View style={styles.totalsBox}>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Total ATL</Text>
          <Text style={styles.totalsValue}>{formatCurrency(totals.totalATL, budget.moedaBase)}</Text>
        </View>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Total BTL</Text>
          <Text style={styles.totalsValue}>{formatCurrency(totals.totalBTL, budget.moedaBase)}</Text>
        </View>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Total Fringes</Text>
          <Text style={styles.totalsValue}>{formatCurrency(totals.totalFringes, budget.moedaBase)}</Text>
        </View>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Contingência ({budget.contingenciaPercentual}% sobre BTL)</Text>
          <Text style={styles.totalsValue}>{formatCurrency(totals.contingencia, budget.moedaBase)}</Text>
        </View>
        <View style={styles.grandRow}>
          <Text style={styles.grandLabel}>GRAND TOTAL</Text>
          <Text style={styles.grandValue}>{formatCurrency(totals.grandTotal, budget.moedaBase)}</Text>
        </View>
      </View>
    </>
  );
}
