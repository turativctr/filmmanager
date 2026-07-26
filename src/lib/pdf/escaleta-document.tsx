import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { EscaletaData, EscaletaSceneRow } from "@/lib/ad-documents-data";
import { formatPaginas } from "@/lib/paginas";
import { CastLegend, colors, kit, periodoAbrev, StandardFooter, StandardHeader, Table, Td, Tr } from "@/lib/pdf/kit";

// Cores por linha — ver spec da Escaleta: mesma família Material 100 usada no Hora a Hora.
const ROW_BG: Record<EscaletaSceneRow["corCategoria"], string | undefined> = {
  principal: undefined,
  noite: "#C5CAE9",
  especial: "#FFF9C4",
  dia0: "#EDE7F6",
};

const styles = StyleSheet.create({
  sceneNumCell: {
    width: "8%",
    paddingVertical: 6,
    paddingHorizontal: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  sceneNumText: { fontSize: 16, fontWeight: 700 },
  legendCaption: { fontSize: 7, color: colors.medGray, marginBottom: 6, fontStyle: "italic" },
});

function SceneRow({ scene }: { scene: EscaletaSceneRow }) {
  return (
    <Tr bg={ROW_BG[scene.corCategoria]} wrap={false}>
      <View style={styles.sceneNumCell}>
        <Text style={styles.sceneNumText}>{scene.numero}</Text>
      </View>
      <Td width="8%">{scene.tipo ?? "—"}</Td>
      <Td width="6%">{periodoAbrev(scene.periodo)}</Td>
      <Td width="16%">{scene.local}</Td>
      <Td width="28%">{scene.sinopse || "—"}</Td>
      <Td width="6%" align="right">
        {formatPaginas(scene.paginas)}
      </Td>
      <Td width="14%">{scene.personagens.join(", ") || "—"}</Td>
      <Td width="14%">{scene.notasAD || "—"}</Td>
    </Tr>
  );
}

export function EscaletaDocument({ data }: { data: EscaletaData }) {
  return (
    <Document>
      <Page size="A4" style={kit.pageV2}>
        <StandardHeader
          projectTitulo={data.titulo}
          diretor={data.diretor}
          producao={data.producao}
          documentTitle="Escaleta"
        />

        <CastLegend entries={data.legend} />

        <Table>
          <Tr header dark>
            <Td width="8%">Nº</Td>
            <Td width="8%">INT/EXT</Td>
            <Td width="6%">D/N</Td>
            <Td width="16%">LOCAL</Td>
            <Td width="28%">SINOPSE</Td>
            <Td width="6%" align="right">
              PÁGS
            </Td>
            <Td width="14%">PERSONAGENS</Td>
            <Td width="14%">NOTAS</Td>
          </Tr>
          {data.scenes.map((scene) => (
            <SceneRow key={scene.numero} scene={scene} />
          ))}
        </Table>

        <Text style={{ ...styles.legendCaption, marginTop: 6 }}>
          Cor da linha: branco = locação principal · azul = noite · amarelo = dia fora da base · roxo = devaneio/Dia 0
        </Text>

        <StandardFooter projectTitulo={data.titulo} documentName="Escaleta" />
      </Page>
    </Document>
  );
}
