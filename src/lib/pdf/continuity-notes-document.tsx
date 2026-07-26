import { Document, Page, Text, View } from "@react-pdf/renderer";

import { naturalCompare } from "@/lib/natural-sort";
import { kit, SectionTitle, StandardFooter, StandardHeader } from "@/lib/pdf/kit";

export type ContinuityNotesData = {
  titulo: string;
  diretor: string | null;
  producao: string | null;
  scenes: { numero: string; notes: { texto: string; numeroDia: number | null }[] }[];
};

export function ContinuityNotesDocument({ data }: { data: ContinuityNotesData }) {
  const sorted = [...data.scenes].sort((a, b) => naturalCompare(a.numero, b.numero));

  return (
    <Document>
      <Page size="A4" style={kit.pageV2}>
        <StandardHeader
          projectTitulo={data.titulo}
          diretor={data.diretor}
          producao={data.producao}
          documentTitle="Notas de Continuidade"
        />

        {sorted.length === 0 && <Text style={kit.muted}>Nenhuma nota de continuidade registrada.</Text>}

        {sorted.map((scene) => (
          <View key={scene.numero} wrap={false} style={{ marginBottom: 10 }}>
            <SectionTitle>Cena {scene.numero}</SectionTitle>
            {scene.notes.map((note, i) => (
              <Text key={i} style={{ fontSize: 8, marginBottom: 3 }}>
                {note.numeroDia != null && <Text style={kit.bold}>[Diária {note.numeroDia}] </Text>}
                {note.texto}
              </Text>
            ))}
          </View>
        ))}

        <StandardFooter projectTitulo={data.titulo} documentName="Notas de Continuidade" />
      </Page>
    </Document>
  );
}
