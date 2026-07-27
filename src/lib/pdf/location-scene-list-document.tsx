import { Document, Page, Text, View } from "@react-pdf/renderer";

import type { LocationSceneListData } from "@/lib/ad-documents-data";
import { kit, SectionTitle, StandardFooter, StandardHeader, Table, Td, Tr } from "@/lib/pdf/kit";

export function LocationSceneListDocument({ data }: { data: LocationSceneListData }) {
  return (
    <Document>
      <Page size="A4" style={kit.pageV2}>
        <StandardHeader
          projectTitulo={data.titulo}
          diretor={data.diretor}
          producao={data.producao}
          documentTitle="Lista de Cenas por Locação"
        />

        {data.locations.length === 0 && <Text style={kit.muted}>Nenhuma cena cadastrada.</Text>}

        {data.locations.map((location) => (
          <View key={location.nome} wrap={false} style={{ marginBottom: 10 }}>
            <SectionTitle>{location.nome}</SectionTitle>
            {location.endereco && <Text style={kit.muted}>{location.endereco}</Text>}
            <Table>
              <Tr header dark>
                <Td width="15%">CENA</Td>
                <Td width="25%">DIÁRIA</Td>
                <Td width="60%">ELENCO</Td>
              </Tr>
              {location.scenes.map((scene, i) => (
                <Tr key={i} alt={i % 2 === 1}>
                  <Td width="15%" bold>
                    {scene.numero}
                  </Td>
                  <Td width="25%">{scene.numeroDia != null ? `Diária ${scene.numeroDia}` : "Não agendada"}</Td>
                  <Td width="60%">{scene.elenco.length > 0 ? scene.elenco.join(", ") : "—"}</Td>
                </Tr>
              ))}
            </Table>
          </View>
        ))}

        <StandardFooter projectTitulo={data.titulo} documentName="Lista de Cenas por Locação" />
      </Page>
    </Document>
  );
}
