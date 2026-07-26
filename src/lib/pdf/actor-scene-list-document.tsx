import { Document, Page, Text, View } from "@react-pdf/renderer";

import type { ActorSceneListData } from "@/lib/ad-documents-data";
import { getCharacterId } from "@/lib/character-id";
import { kit, SectionTitle, StandardFooter, StandardHeader, Table, Td, Tr } from "@/lib/pdf/kit";

export function ActorSceneListDocument({ data }: { data: ActorSceneListData }) {
  return (
    <Document>
      <Page size="A4" style={kit.pageV2}>
        <StandardHeader
          projectTitulo={data.titulo}
          diretor={data.diretor}
          producao={data.producao}
          documentTitle="Lista de Cenas por Ator"
        />

        {data.actors.length === 0 && <Text style={kit.muted}>Nenhum personagem com cenas cadastradas.</Text>}

        {data.actors.map((actor) => (
          <View key={actor.idCurto} wrap={false} style={{ marginBottom: 10 }}>
            <SectionTitle>
              {getCharacterId(actor, data)} — {actor.personagem}
              {actor.ator ? ` (${actor.ator})` : ""}
            </SectionTitle>
            <Table>
              <Tr header dark>
                <Td width="15%">CENA</Td>
                <Td width="55%">LOCAÇÃO</Td>
                <Td width="30%">DIÁRIA</Td>
              </Tr>
              {actor.scenes.map((scene, i) => (
                <Tr key={i} alt={i % 2 === 1}>
                  <Td width="15%" bold>
                    {scene.numero}
                  </Td>
                  <Td width="55%">{scene.locacao ?? "—"}</Td>
                  <Td width="30%">{scene.numeroDia != null ? `Diária ${scene.numeroDia}` : "Não agendada"}</Td>
                </Tr>
              ))}
            </Table>
          </View>
        ))}

        <StandardFooter projectTitulo={data.titulo} documentName="Lista de Cenas por Ator" />
      </Page>
    </Document>
  );
}
