import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatFullDate } from "@/lib/calendar-grid";
import { colors, kit, resolveLogoBuffer } from "@/lib/pdf/kit";
import type { ShootDayReportData } from "@/lib/report-data";

/** Campos do Project usados no Boletim de Continuísmo — bem menos que o Project inteiro, já que
 *  quem chama (route.tsx) passa o objeto completo retornado por findOwnedProject(). */
export type ContinuismoProject = {
  titulo: string;
  logoUrl: string | null;
  continuismoResponsavel: string;
  continuismoUsarLogo: boolean;
};

/** Uma linha da tabela principal: cena + plano pré-preenchidos a partir da ordem de filmagem do
 *  dia (data.horaAHoraPlanos, já achatado pelo chamador); take e observações ficam em branco —
 *  este documento é impresso e preenchido à mão no set. */
export type ContinuismoRow = {
  id: string;
  sceneNumero: string;
  numero: string;
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.black,
  },
  headerLogo: { width: 44, height: 44, marginRight: 8, objectFit: "contain" },
  headerLeft: { flex: 1.4 },
  headerProjectName: { fontSize: 10, fontWeight: 700, color: colors.black },
  headerTitle: { fontSize: 16, fontWeight: 700, color: colors.black, marginTop: 1 },
  headerRight: { flex: 1, alignItems: "flex-end" },
  headerResponsavel: { fontSize: 8, color: colors.medGray },
  headerFolha: { fontSize: 9, fontWeight: 700, color: colors.black, marginTop: 2 },
  headerDate: { fontSize: 8, color: colors.medGray, marginTop: 2 },

  row: {
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderV2,
  },
  cell: {
    justifyContent: "center",
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderRightWidth: 0.5,
    borderRightColor: colors.borderV2,
  },
  cellLast: { borderRightWidth: 0 },
  cellText: { fontSize: 8.5 },
  headerCell: {
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRightWidth: 0.5,
    borderRightColor: colors.tableHeaderBg,
  },
  headerCellText: { fontSize: 8, fontWeight: 700, color: "#ffffff" },

  legend: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: colors.borderV2,
  },
  legendSwatch: { width: 9, height: 9, marginRight: 3, borderWidth: 0.5, borderColor: colors.borderV2 },
  legendLabel: { fontSize: 7.5, color: colors.darkGray, marginRight: 14 },
});

const COL_WIDTHS = { cena: "14%", plano: "14%", take: "14%", observacoes: "58%" } as const;

/** Cabeçalho repetido em toda folha (react-pdf: View `fixed` dentro de `<Page>`). Contém logo
 *  (se project.continuismoUsarLogo e logoUrl definidos) | nome do projeto | "CONTINUÍSMO" |
 *  responsável | "FOLHA Nº X de Y" (numeração dinâmica via `render`) | data da diária. */
function ContinuismoHeader({
  project,
  logoBuffer,
  dateLabel,
}: {
  project: ContinuismoProject;
  logoBuffer: Buffer | null;
  dateLabel: string;
}) {
  const showLogo = project.continuismoUsarLogo && Boolean(logoBuffer);

  return (
    <View style={styles.header} fixed>
      {showLogo && (
        // eslint-disable-next-line jsx-a11y/alt-text -- <Image> aqui é do @react-pdf/renderer (PDF), não next/image; não aceita alt.
        <Image src={logoBuffer as Buffer} style={styles.headerLogo} />
      )}
      <View style={styles.headerLeft}>
        <Text style={styles.headerProjectName}>{project.titulo}</Text>
        <Text style={styles.headerTitle}>CONTINUÍSMO</Text>
      </View>
      <View style={styles.headerRight}>
        <Text style={styles.headerResponsavel}>{project.continuismoResponsavel}</Text>
        <Text style={styles.headerFolha} render={({ pageNumber, totalPages }) => `FOLHA Nº ${pageNumber} de ${totalPages}`} />
        <Text style={styles.headerDate}>{dateLabel}</Text>
      </View>
    </View>
  );
}

function TableHeaderRow() {
  return (
    <View style={{ ...styles.row, minHeight: 0, backgroundColor: colors.tableHeaderBg, borderBottomWidth: 0 }} fixed>
      <View style={{ ...styles.headerCell, width: COL_WIDTHS.cena }}>
        <Text style={styles.headerCellText}>CENA</Text>
      </View>
      <View style={{ ...styles.headerCell, width: COL_WIDTHS.plano }}>
        <Text style={styles.headerCellText}>PLANO</Text>
      </View>
      <View style={{ ...styles.headerCell, width: COL_WIDTHS.take }}>
        <Text style={styles.headerCellText}>TAKE</Text>
      </View>
      <View style={{ ...styles.headerCell, width: COL_WIDTHS.observacoes, borderRightWidth: 0 }}>
        <Text style={styles.headerCellText}>OBSERVAÇÕES</Text>
      </View>
    </View>
  );
}

function ContinuismoTableRow({ row, alt }: { row: ContinuismoRow; alt: boolean }) {
  return (
    <View style={{ ...styles.row, backgroundColor: alt ? colors.rowAlt : "#ffffff" }} wrap={false}>
      <View style={{ ...styles.cell, width: COL_WIDTHS.cena }}>
        <Text style={styles.cellText}>{row.sceneNumero}</Text>
      </View>
      <View style={{ ...styles.cell, width: COL_WIDTHS.plano }}>
        <Text style={styles.cellText}>{row.numero}</Text>
      </View>
      {/* TAKE e OBSERVAÇÕES ficam em branco de propósito — preenchidos à mão no set. */}
      <View style={{ ...styles.cell, width: COL_WIDTHS.take }}>
        <Text style={styles.cellText}> </Text>
      </View>
      <View style={{ ...styles.cell, width: COL_WIDTHS.observacoes, borderRightWidth: 0 }}>
        <Text style={styles.cellText}> </Text>
      </View>
    </View>
  );
}

/** Legenda fixa dos códigos usados à mão pelo continuísta para marcar o resultado de cada take —
 *  aparece uma vez, ao final do documento (última página). */
function ContinuismoLegend() {
  return (
    <View style={styles.legend}>
      <View style={{ ...styles.legendSwatch, backgroundColor: colors.successBg }} />
      <Text style={styles.legendLabel}>SIM (fundo verde claro)</Text>
      <View style={{ ...styles.legendSwatch, backgroundColor: colors.amberBg }} />
      <Text style={styles.legendLabel}>OK (fundo amarelo claro)</Text>
      <View style={{ ...styles.legendSwatch, backgroundColor: colors.dangerBg }} />
      <Text style={styles.legendLabel}>NÃO (fundo vermelho claro)</Text>
    </View>
  );
}

export function ContinuismoDocument({
  data,
  project,
}: {
  data: ShootDayReportData;
  project: ContinuismoProject;
}) {
  const logoBuffer = resolveLogoBuffer(project.logoUrl);
  const dateLabel = formatFullDate(data.shootDay.data);

  const rows: ContinuismoRow[] = data.horaAHoraPlanos.flatMap((block) =>
    block.planos.map((p) => ({ id: p.id, sceneNumero: block.numero, numero: p.numero }))
  );

  return (
    <Document>
      <Page size="A4" style={kit.pageV2}>
        <ContinuismoHeader project={project} logoBuffer={logoBuffer} dateLabel={dateLabel} />

        <View style={{ borderWidth: 0.5, borderColor: colors.borderV2 }}>
          <TableHeaderRow />
          {rows.length === 0 ? (
            <View style={styles.row}>
              <View style={{ ...styles.cell, width: "100%", borderRightWidth: 0 }}>
                <Text style={{ ...styles.cellText, color: colors.medGray }}>
                  Nenhum plano cadastrado nesta diária.
                </Text>
              </View>
            </View>
          ) : (
            rows.map((row, i) => <ContinuismoTableRow key={row.id} row={row} alt={i % 2 === 1} />)
          )}
        </View>

        <ContinuismoLegend />
      </Page>
    </Document>
  );
}
