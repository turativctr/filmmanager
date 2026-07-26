import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { AccountGroupData, BudgetData } from "@/components/budget/types";
import { formatCurrency, sumTotals } from "@/lib/budget-calc";
import { colors, kit, SectionTitle, Table, Td, Tr } from "@/lib/pdf/kit";
import { TopsheetSummarySection } from "@/lib/pdf/topsheet-summary";

const styles = StyleSheet.create({
  cover: { flex: 1, alignItems: "center", justifyContent: "center" },
  coverProject: { fontSize: 22, fontWeight: 700, textAlign: "center", marginBottom: 8 },
  coverDocTitle: { fontSize: 14, color: colors.muted, textAlign: "center", marginBottom: 24 },
  coverMetaRow: { fontSize: 10, textAlign: "center", marginBottom: 4 },
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
  subtotalRow: { backgroundColor: colors.headerBgLight },
  groupTotalRow: { backgroundColor: colors.headerBg },
  groupTotalText: { color: "#ffffff", fontWeight: 700 },
  globalMark: { fontSize: 7, color: colors.muted },
  coverLegend: { fontSize: 8, color: colors.muted, textAlign: "center", marginTop: 16 },
});

function Footer({ projectTitulo, versao }: { projectTitulo: string; versao: string }) {
  return (
    <Text
      style={styles.footer}
      fixed
      render={({ pageNumber, totalPages }) =>
        `${projectTitulo} · versão ${versao} · página ${pageNumber} de ${totalPages}`
      }
    />
  );
}

function GroupSection({ group, moedaBase }: { group: AccountGroupData; moedaBase: string }) {
  const groupTotal = sumTotals(group.accounts.flatMap((a) => a.lineItems));

  return (
    <View>
      <SectionTitle>
        {group.codigo} — {group.nome}
      </SectionTitle>
      <Table>
        <Tr header>
          <Td width="28%" bold>
            Descrição
          </Td>
          <Td width="7%" bold align="right">
            Qtd
          </Td>
          <Td width="12%" bold>
            Unid.
          </Td>
          <Td width="15%" bold align="center">
            Período
          </Td>
          <Td width="12%" bold align="right">
            Taxa
          </Td>
          <Td width="7%" bold align="center">
            Moeda
          </Td>
          <Td width="19%" bold align="right">
            Total
          </Td>
        </Tr>
        {group.accounts.map((account) => {
          const accountTotal = sumTotals(account.lineItems);
          return (
            <View key={account.id}>
              {account.lineItems.map((item) => (
                <Tr key={item.id}>
                  <Td width="28%">{item.descricao}</Td>
                  <Td width="7%" align="right">
                    {item.quantidade}
                  </Td>
                  <Td width="12%">{item.unidade}</Td>
                  <Td width="15%" align="center">
                    {item.periodo}
                    {item.globalRef && <Text style={styles.globalMark}> [G]</Text>}
                  </Td>
                  <Td width="12%" align="right">
                    {formatCurrency(item.taxa, item.moeda)}
                  </Td>
                  <Td width="7%" align="center">
                    {item.moeda}
                  </Td>
                  <Td width="19%" align="right">
                    {formatCurrency(item.total, moedaBase)}
                  </Td>
                </Tr>
              ))}
              {account.lineItems.length > 0 && (
                <View style={styles.subtotalRow}>
                  <Tr>
                    <Td width="81%" bold align="right">
                      Sub-total {account.codigo} — {account.nome}
                    </Td>
                    <Td width="19%" bold align="right">
                      {formatCurrency(accountTotal, moedaBase)}
                    </Td>
                  </Tr>
                </View>
              )}
            </View>
          );
        })}
        <View style={styles.groupTotalRow}>
          <Tr>
            <Td width="81%" align="right">
              <Text style={styles.groupTotalText}>Total {group.nome}</Text>
            </Td>
            <Td width="19%" align="right">
              <Text style={styles.groupTotalText}>{formatCurrency(groupTotal, moedaBase)}</Text>
            </Td>
          </Tr>
        </View>
      </Table>
    </View>
  );
}

export function BudgetDetailedDocument({
  budget,
  project,
}: {
  budget: BudgetData;
  project: { titulo: string; diretor: string | null; producao: string | null };
}) {
  const dataGeracao = new Date().toLocaleDateString("pt-BR");

  return (
    <Document>
      <Page size="A4" style={kit.page}>
        <View style={styles.cover}>
          <Text style={styles.coverProject}>{project.titulo}</Text>
          <Text style={styles.coverDocTitle}>Orçamento de Produção</Text>
          <Text style={styles.coverMetaRow}>Versão {budget.versao}</Text>
          <Text style={styles.coverMetaRow}>Gerado em {dataGeracao}</Text>
          {project.diretor && <Text style={styles.coverMetaRow}>Direção: {project.diretor}</Text>}
          {project.producao && <Text style={styles.coverMetaRow}>Produção: {project.producao}</Text>}
          <Text style={styles.coverLegend}>[G] na coluna Período indica valor calculado a partir de um Global (ver aba Globals e Fringes).</Text>
        </View>
        <Footer projectTitulo={project.titulo} versao={budget.versao} />
      </Page>

      {budget.accountGroups.map((group) => (
        <Page key={group.id} size="A4" style={kit.page}>
          <GroupSection group={group} moedaBase={budget.moedaBase} />
          <Footer projectTitulo={project.titulo} versao={budget.versao} />
        </Page>
      ))}

      <Page size="A4" style={kit.page}>
        <TopsheetSummarySection budget={budget} />
        <Footer projectTitulo={project.titulo} versao={budget.versao} />
      </Page>
    </Document>
  );
}
