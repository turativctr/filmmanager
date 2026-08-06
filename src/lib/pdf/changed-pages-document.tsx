import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { getCharacterId } from "@/lib/character-id";
import type { DraftDiffRow, ScriptDraftDetail } from "@/lib/draft-report-data";
import { naturalCompare } from "@/lib/natural-sort";
import { formatPaginas } from "@/lib/paginas";
import { colors, kit, StandardFooter, SummaryCard, SummaryCardsRow } from "@/lib/pdf/kit";
import { revisionColorHex } from "@/lib/revision-colors";
import { diffSinopse } from "@/lib/script-diff";

const PERIODO_LABEL: Record<string, string> = {
  DIA: "Dia",
  NOITE: "Noite",
  ENTARDECER: "Entardecer",
  AMANHECER: "Amanhecer",
  CONTINUO: "Contínuo",
  DEPOIS: "Depois",
  NOITE_PARA_DIA: "Noite para dia",
  DIA_PARA_NOITE: "Dia para noite",
};

const styles = StyleSheet.create({
  header: { marginBottom: 12 },
  headerProject: { fontSize: 14, fontWeight: 700, color: colors.black },
  headerCredits: { fontSize: 9, color: colors.medGray, marginTop: 2 },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 7,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.black,
  },
  titleText: { fontSize: 12, fontWeight: 700, color: colors.black },
  draftBadge: { paddingVertical: 3, paddingHorizontal: 7, borderRadius: 2 },
  draftBadgeText: { fontSize: 8, fontWeight: 700 },
  draftMeta: { fontSize: 8, color: colors.medGray, marginTop: 3 },

  impactBox: {
    borderWidth: 0.75,
    borderColor: colors.amber,
    backgroundColor: colors.amberBg,
    padding: 6,
    marginBottom: 10,
  },
  impactTitle: { fontSize: 8, fontWeight: 700, color: colors.amber, marginBottom: 3 },
  impactLine: { fontSize: 7.5, color: colors.darkGray, marginBottom: 1.5 },

  sceneSection: { marginBottom: 10, borderWidth: 0.75, borderColor: colors.borderV2 },
  sceneHeaderBase: { padding: 5 },
  sceneHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sceneHeaderText: { fontSize: 10, fontWeight: 700 },
  asterisk: { fontSize: 10, fontWeight: 700, color: colors.danger },

  sceneBody: { padding: 6 },
  metaLine: { fontSize: 7.5, marginBottom: 3 },
  fieldChangeBlock: { marginBottom: 5 },
  fieldChangeLabel: { fontSize: 8, fontWeight: 700, marginBottom: 1 },
  beforeLine: { fontSize: 7.5, marginBottom: 1 },
  afterLine: { fontSize: 7.5 },
  removedText: { textDecoration: "line-through", color: colors.medGray },
  normalText: { color: colors.black },
  sinopseBeforeLine: {
    fontSize: 7,
    color: colors.medGray,
    textDecoration: "line-through",
    lineHeight: 1.4,
    marginBottom: 2,
  },
  sinopseAfterLine: { fontSize: 7.5, color: colors.black, lineHeight: 1.4 },
  sinopseRemovedEmphasis: { fontWeight: 700, color: colors.danger },
  sinopseAddedEmphasis: { fontWeight: 700, color: colors.success },
  impactInlineBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.amberBg,
    borderWidth: 0.5,
    borderColor: colors.amber,
    color: colors.amber,
    fontSize: 7,
    fontWeight: 700,
    paddingVertical: 2,
    paddingHorizontal: 5,
    marginTop: 3,
  },
});

function SceneSnapshot({
  scene,
  project,
}: {
  scene: NonNullable<DraftDiffRow["scene"]>;
  project: ScriptDraftDetail["project"];
}) {
  return (
    <View style={styles.sceneBody}>
      <Text style={styles.metaLine}>
        {scene.tipo ?? "—"} · {scene.periodo ? PERIODO_LABEL[scene.periodo] ?? scene.periodo : "—"} ·{" "}
        {scene.locacao || scene.set || "—"} ·{" "}
        {formatPaginas(scene.paginas)}
      </Text>
      <Text style={styles.metaLine}>{scene.sinopse || "Sem sinopse."}</Text>
      <Text style={styles.metaLine}>
        <Text style={kit.bold}>Elenco: </Text>
        {scene.cast.length > 0 ? scene.cast.map((c) => getCharacterId(c, project)).join(", ") : "—"}
      </Text>
    </View>
  );
}

function CastChangeLine({ antes, depois }: { antes: string[]; depois: string[] }) {
  const antesSet = new Set(antes.map((n) => n.toUpperCase()));
  const depoisSet = new Set(depois.map((n) => n.toUpperCase()));
  const added = depois.filter((n) => !antesSet.has(n.toUpperCase()));
  const removed = antes.filter((n) => !depoisSet.has(n.toUpperCase()));
  const annotations = [...added.map((n) => `+${n}`), ...removed.map((n) => `-${n}`)];

  return (
    <Text style={styles.afterLine}>
      <Text style={styles.fieldChangeLabel}>Personagens: </Text>
      {antes.join(", ") || "—"} {"->"} {depois.join(", ") || "—"}
      {annotations.length > 0 ? ` (${annotations.join(", ")})` : ""}
    </Text>
  );
}

function FieldChangeText({ campo, antes, depois }: { campo: string; antes: unknown; depois: unknown }) {
  if (campo === "sinopse") {
    const antesText = typeof antes === "string" ? antes : "";
    const depoisText = typeof depois === "string" ? depois : "";
    const parts = diffSinopse(antesText, depoisText);
    return (
      <View style={styles.fieldChangeBlock}>
        <Text style={styles.fieldChangeLabel}>Sinopse</Text>
        <Text style={styles.sinopseBeforeLine}>
          ANTES:{" "}
          {parts
            .filter((p) => p.tipo !== "adicionado")
            .map((p, i) => (
              <Text key={i} style={p.tipo === "removido" ? styles.sinopseRemovedEmphasis : undefined}>
                {p.texto}
              </Text>
            ))}
        </Text>
        <Text style={styles.sinopseAfterLine}>
          DEPOIS:{" "}
          {parts
            .filter((p) => p.tipo !== "removido")
            .map((p, i) => (
              <Text key={i} style={p.tipo === "adicionado" ? styles.sinopseAddedEmphasis : undefined}>
                {p.texto}
              </Text>
            ))}
        </Text>
      </View>
    );
  }

  if (campo === "personagens") {
    return (
      <View style={styles.fieldChangeBlock}>
        <CastChangeLine antes={Array.isArray(antes) ? (antes as string[]) : []} depois={Array.isArray(depois) ? (depois as string[]) : []} />
      </View>
    );
  }

  const format = (v: unknown) => (Array.isArray(v) ? v.join(", ") : v == null || v === "" ? "—" : String(v));
  return (
    <View style={styles.fieldChangeBlock}>
      <Text style={styles.fieldChangeLabel}>{campo}</Text>
      <Text style={styles.beforeLine}>
        ANTES: <Text style={styles.removedText}>{format(antes)}</Text>
      </Text>
      <Text style={styles.afterLine}>
        DEPOIS: <Text style={styles.normalText}>{format(depois)}</Text>
      </Text>
    </View>
  );
}

export function ChangedPagesDocument({ detail }: { detail: ScriptDraftDetail }) {
  const { project, draft, diffs, impacts } = detail;

  const adicionadas = diffs.filter((d) => d.tipo === "ADICIONADA").length;
  const removidas = diffs.filter((d) => d.tipo === "REMOVIDA").length;
  const modificadas = diffs.filter((d) => d.tipo === "MODIFICADA").length;

  const sorted = [...diffs].sort((a, b) => naturalCompare(a.numero, b.numero));
  const impactsByNumero = new Map<string, typeof impacts>();
  for (const impact of impacts) {
    impactsByNumero.set(impact.sceneNumero, [...(impactsByNumero.get(impact.sceneNumero) ?? []), impact]);
  }

  const draftBadgeColors = revisionColorHex(draft.corRevisao);

  return (
    <Document>
      <Page size="A4" style={kit.pageV2}>
        <View style={styles.header}>
          <Text style={styles.headerProject}>{project.titulo}</Text>
          {(project.diretor || project.producao) && (
            <Text style={styles.headerCredits}>
              {[project.diretor && `Direção: ${project.diretor}`, project.producao && `Produtora: ${project.producao}`]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          )}
          <View style={styles.titleRow}>
            <Text style={styles.titleText}>Páginas Alteradas</Text>
            <View style={{ ...styles.draftBadge, backgroundColor: draftBadgeColors.bg }}>
              <Text style={{ ...styles.draftBadgeText, color: draftBadgeColors.text }}>
                {draft.numero}ª REVISÃO — {draft.corRevisao.toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={styles.draftMeta}>
            {draft.numeroDraft ? `${draft.numeroDraft} · ` : ""}
            {draft.dataDraft || new Date(draft.importedAt).toLocaleDateString("pt-BR")}
          </Text>
        </View>

        <SummaryCardsRow>
          <SummaryCard icon="+" iconColor={colors.success} value={adicionadas} label="cena(s) nova(s)" />
          <SummaryCard icon="-" iconColor={colors.danger} value={removidas} label="omitida(s)" />
          <SummaryCard icon="~" iconColor={colors.amber} value={modificadas} label="modificada(s)" />
        </SummaryCardsRow>

        {impacts.length > 0 && (
          <View style={styles.impactBox}>
            <Text style={styles.impactTitle}>ATENÇÃO — Impactos no agendamento</Text>
            {impacts.map((impact, i) => (
              <Text key={i} style={styles.impactLine}>
                Diária {impact.numeroDia}: {impact.motivo}
              </Text>
            ))}
          </View>
        )}

        {sorted.map((diff) => {
          const sceneImpacts = impactsByNumero.get(diff.numero) ?? [];
          return (
            <View key={diff.numero} style={styles.sceneSection} wrap={false}>
              {diff.tipo === "ADICIONADA" && (
                <View style={{ ...styles.sceneHeaderBase, backgroundColor: colors.successBg }}>
                  <Text style={{ ...styles.sceneHeaderText, color: colors.success }}>CENA {diff.numero} — NOVA +</Text>
                </View>
              )}
              {diff.tipo === "REMOVIDA" && (
                <View style={{ ...styles.sceneHeaderBase, backgroundColor: colors.lightGray }}>
                  <Text style={{ ...styles.sceneHeaderText, color: colors.medGray, textDecoration: "line-through" }}>
                    CENA {diff.numero} — OMITIDA
                  </Text>
                </View>
              )}
              {diff.tipo === "MODIFICADA" && (
                <View style={{ ...styles.sceneHeaderBase, ...styles.sceneHeaderRow }}>
                  <Text style={styles.sceneHeaderText}>CENA {diff.numero} — MODIFICADA</Text>
                  <Text style={styles.asterisk}>*</Text>
                </View>
              )}

              {diff.tipo === "REMOVIDA" && (
                <View style={styles.sceneBody}>
                  <Text style={styles.metaLine}>Cena removida do roteiro nesta revisão.</Text>
                </View>
              )}

              {diff.tipo === "ADICIONADA" && diff.scene && <SceneSnapshot scene={diff.scene} project={project} />}

              {diff.tipo === "MODIFICADA" && (
                <View style={styles.sceneBody}>
                  {diff.camposAlterados &&
                    Object.entries(diff.camposAlterados).map(([campo, change]) => (
                      <FieldChangeText key={campo} campo={campo} antes={change.antes} depois={change.depois} />
                    ))}
                  {sceneImpacts.length > 0 && <Text style={styles.impactInlineBadge}>Impacto: Scheduling</Text>}
                </View>
              )}
            </View>
          );
        })}

        <StandardFooter
          projectTitulo={project.titulo}
          versionLabel={`Draft ${draft.numero} (${draft.corRevisao})`}
          documentName="Páginas Alteradas"
        />
      </Page>
    </Document>
  );
}
