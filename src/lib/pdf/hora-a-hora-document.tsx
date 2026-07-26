import type { HoraAHoraEventTipo } from "@prisma/client";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatFullDate, weekdayNameFull } from "@/lib/calendar-grid";
import { colors, kit, StandardFooter, StandardHeader } from "@/lib/pdf/kit";
import { formatHHh } from "@/lib/schedule";

export type HoraAHoraDocumentEvent = {
  id: string;
  horaInicio: string;
  horaFim: string | null;
  descricao: string;
  tipo: HoraAHoraEventTipo;
};

export type HoraAHoraDocumentData = {
  project: { titulo: string; diretor: string | null; producao: string | null };
  shootDay: { numeroDia: number; data: string };
  events: HoraAHoraDocumentEvent[];
};

// Cores de fundo por tipo de evento — ver spec do Hora a Hora; mesma família Material 50-100
// usada nas cores por linha da Escaleta, para os documentos novos ficarem visualmente coerentes.
const TIPO_STYLE: Record<
  HoraAHoraEventTipo,
  { bg: string; color: string; bold?: boolean; italic?: boolean; centered?: boolean }
> = {
  CHAMADA_EQUIPE: { bg: "#F0F0F0", color: colors.black },
  CHAMADA_ELENCO: { bg: "#E3F2FD", color: colors.black },
  SETUP: { bg: "#FFFDE7", color: colors.black },
  ENSAIO: { bg: "#FFF3E0", color: colors.black },
  RODANDO: { bg: "#E8F5E9", color: colors.black, bold: true },
  ALMOCO: { bg: "#BDBDBD", color: colors.black, centered: true },
  SAIDA: { bg: "#FFFFFF", color: colors.black, italic: true },
  DESPRODUCAO: { bg: "#424242", color: "#FFFFFF" },
  OUTRO: { bg: "#FFFFFF", color: colors.black },
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderV2,
  },
  time: { width: "18%", fontSize: 8.5, fontWeight: 700 },
  descricao: { flex: 1, fontSize: 9 },
  centeredText: { flex: 1, textAlign: "center", fontSize: 9, fontWeight: 700 },
});

export function HoraAHoraDocument({ data }: { data: HoraAHoraDocumentData }) {
  const { project, shootDay, events } = data;

  return (
    <Document>
      <Page size="A4" style={kit.pageV2}>
        <StandardHeader
          projectTitulo={project.titulo}
          diretor={project.diretor}
          producao={project.producao}
          documentTitle={`Hora a Hora — Diária ${shootDay.numeroDia} — ${weekdayNameFull(shootDay.data)}, ${formatFullDate(shootDay.data)}`}
        />

        <View style={{ borderWidth: 0.5, borderColor: colors.borderV2 }}>
          {events.map((event) => {
            const style = TIPO_STYLE[event.tipo];
            const timeLabel = event.horaFim
              ? `${formatHHh(event.horaInicio)} – ${formatHHh(event.horaFim)}`
              : formatHHh(event.horaInicio);
            return (
              <View key={event.id} style={{ ...styles.row, backgroundColor: style.bg }} wrap={false}>
                {style.centered ? (
                  <Text style={{ ...styles.centeredText, color: style.color }}>
                    {timeLabel} — {event.descricao}
                  </Text>
                ) : (
                  <>
                    <Text style={{ ...styles.time, color: style.color }}>{timeLabel}</Text>
                    <Text
                      style={{
                        ...styles.descricao,
                        color: style.color,
                        ...(style.bold ? { fontWeight: 700 } : {}),
                        ...(style.italic ? { fontStyle: "italic" } : {}),
                      }}
                    >
                      {event.descricao}
                    </Text>
                  </>
                )}
              </View>
            );
          })}
          {events.length === 0 && (
            <Text style={{ padding: 8, fontSize: 9, color: colors.medGray }}>Nenhum evento cadastrado.</Text>
          )}
        </View>

        <StandardFooter projectTitulo={project.titulo} documentName="Hora a Hora" />
      </Page>
    </Document>
  );
}
