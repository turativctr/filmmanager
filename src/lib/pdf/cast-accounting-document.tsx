import type { CharacterCategoria, SistemaIdElenco } from "@prisma/client";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { CHARACTER_CATEGORIA_LABEL } from "@/lib/character-categoria";
import { getCharacterId } from "@/lib/character-id";
import { colors, formatBRL, kit, SeparatorRow, StandardFooter, StandardHeader, Table, Td, Tr } from "@/lib/pdf/kit";

const styles = StyleSheet.create({
  noCacheText: { fontSize: 8, fontWeight: 400, color: colors.medGray, fontStyle: "italic" },
  grandTotalRow: { flexDirection: "row", backgroundColor: colors.darkGray, marginTop: 0 },
  grandTotalLabel: { flex: 1, padding: 5, fontSize: 9, fontWeight: 700, color: "#ffffff" },
  grandTotalValue: { padding: 5, fontSize: 10, fontWeight: 700, color: "#ffffff", textAlign: "right" },
  footnote: { fontSize: 7.5, color: colors.medGray, marginTop: 4 },
});

export type CastAccountingDocRow = {
  idCurto: string;
  numeroElenco: number | null;
  categoria: CharacterCategoria;
  personagem: string;
  ator: string | null;
  cacheeDiario: number | null;
  percentualHold: number | null;
  diasTrabalhados: number;
  diasHold: number;
};

export function CastAccountingDocument({
  data,
}: {
  data: {
    titulo: string;
    diretor: string | null;
    producao: string | null;
    sistemaIdElenco: SistemaIdElenco;
    rows: CastAccountingDocRow[];
  };
}) {
  let grandTotal = 0;
  let semCacheCount = 0;
  let contadorLinhasComCache = 0;

  return (
    <Document>
      <Page size="A4" style={kit.pageV2}>
        <StandardHeader
          projectTitulo={data.titulo}
          diretor={data.diretor}
          producao={data.producao}
          documentTitle="Prestação de Contas do Elenco"
        />

        <Table>
          <Tr header dark>
            <Td width="10%">ID</Td>
            <Td width="19%">PERSONAGEM</Td>
            <Td width="14%">ATOR</Td>
            <Td width="13%" align="right">
              CACHÊ/DIA
            </Td>
            <Td width="10%" align="right">
              DIAS TRAB.
            </Td>
            <Td width="9%" align="right">
              DIAS HOLD
            </Td>
            <Td width="8%" align="right">
              % HOLD
            </Td>
            <Td width="17%" align="right">
              TOTAL
            </Td>
          </Tr>
          {data.rows.flatMap((row, index) => {
            const semCache = row.cacheeDiario == null;
            let total = 0;
            if (!semCache) {
              const holdPct = row.percentualHold ?? 0;
              total = row.diasTrabalhados * row.cacheeDiario! + row.diasHold * row.cacheeDiario! * (holdPct / 100);
              grandTotal += total;
              contadorLinhasComCache += 1;
            } else {
              semCacheCount += 1;
            }

            // `data.rows` já vem agrupado por categoria (getCastAccountingData) — só insere a
            // divisória quando a categoria muda em relação à linha anterior.
            const showCategoriaDivider = index === 0 || data.rows[index - 1].categoria !== row.categoria;

            const rowEl = (
              <Tr
                key={row.idCurto}
                bg={semCache ? colors.lightGray : undefined}
                alt={!semCache && contadorLinhasComCache % 2 === 0}
              >
                <Td width="10%" bold>
                  {getCharacterId(row, data)}
                </Td>
                <Td width="19%">{row.personagem}</Td>
                <Td width="14%">{row.ator ?? "—"}</Td>
                <Td width="13%" align="right">
                  {row.cacheeDiario != null ? formatBRL(row.cacheeDiario) : "—"}
                </Td>
                <Td width="10%" align="right">
                  {row.diasTrabalhados}
                </Td>
                <Td width="9%" align="right">
                  {row.diasHold}
                </Td>
                <Td width="8%" align="right">
                  {row.diasHold > 0 && row.percentualHold != null ? `${row.percentualHold}%` : "—"}
                </Td>
                <Td width="17%" align="right" bold>
                  {semCache ? <Text style={styles.noCacheText}>Cachê não informado</Text> : formatBRL(total)}
                </Td>
              </Tr>
            );

            return showCategoriaDivider
              ? [<SeparatorRow key={`${row.idCurto}-divider`} label={CHARACTER_CATEGORIA_LABEL[row.categoria]} />, rowEl]
              : [rowEl];
          })}
        </Table>

        <View style={styles.grandTotalRow}>
          <Text style={styles.grandTotalLabel}>GRAND TOTAL</Text>
          <Text style={styles.grandTotalValue}>{formatBRL(grandTotal)}</Text>
        </View>

        {semCacheCount > 0 && (
          <Text style={styles.footnote}>
            * {semCacheCount} {semCacheCount === 1 ? "personagem" : "personagens"} sem cachê cadastrado não incluído
            {semCacheCount === 1 ? "" : "s"} no total.
          </Text>
        )}

        <StandardFooter projectTitulo={data.titulo} documentName="Prestação de Contas do Elenco" />
      </Page>
    </Document>
  );
}
