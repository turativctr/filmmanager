import { Document, Page, Text, View } from "@react-pdf/renderer";

import type { CrewContactListData } from "@/lib/ad-documents-data";
import { kit, SectionTitle, StandardFooter, StandardHeader, Table, Td, Tr } from "@/lib/pdf/kit";

export function CrewContactListDocument({ data }: { data: CrewContactListData }) {
  const byDepartment = new Map<string, CrewContactListData["crew"]>();
  for (const member of data.crew) {
    const key = member.departamento || "Geral";
    const list = byDepartment.get(key) ?? [];
    list.push(member);
    byDepartment.set(key, list);
  }

  return (
    <Document>
      <Page size="A4" style={kit.pageV2}>
        <StandardHeader
          projectTitulo={data.titulo}
          diretor={data.diretor}
          producao={data.producao}
          documentTitle="Lista de Contatos da Equipe"
        />

        {data.crew.length === 0 && <Text style={kit.muted}>Nenhum membro de equipe cadastrado.</Text>}

        {[...byDepartment.entries()].map(([departamento, members]) => (
          <View key={departamento} wrap={false} style={{ marginBottom: 10 }}>
            <SectionTitle>{departamento}</SectionTitle>
            <Table>
              <Tr header dark>
                <Td width="25%">NOME</Td>
                <Td width="25%">FUNÇÃO</Td>
                <Td width="20%">TELEFONE</Td>
                <Td width="30%">EMAIL</Td>
              </Tr>
              {members.map((m, i) => (
                <Tr key={m.id} alt={i % 2 === 1}>
                  <Td width="25%" bold>
                    {m.nome}
                  </Td>
                  <Td width="25%">{m.funcao}</Td>
                  <Td width="20%">{m.telefone ?? "—"}</Td>
                  <Td width="30%">{m.email ?? "—"}</Td>
                </Tr>
              ))}
            </Table>
          </View>
        ))}

        <StandardFooter projectTitulo={data.titulo} documentName="Lista de Contatos da Equipe" />
      </Page>
    </Document>
  );
}
