import * as React from "react";

import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ShotTipoReset } from "@prisma/client";

// Paleta original — usada também pelos documentos de Budget/Breakdown/HH Schedule,
// que não fazem parte deste redesenho visual. Nunca alterar os valores abaixo;
// só adicionar chaves novas (ver bloco "paleta do redesenho" logo depois).
export const colors = {
  text: "#111111",
  muted: "#555555",
  border: "#c9ccd1",
  headerBg: "#1f2937",
  headerBgLight: "#eef0f3",
  danger: "#b91c1c",
  dangerBg: "#fdecec",

  // Paleta do redesenho visual (Call Sheet + Documentos do AD) — nomes novos,
  // não reutilizar as chaves acima para não mexer nos documentos de Budget/Reports.
  black: "#000000",
  darkGray: "#333333",
  medGray: "#666666",
  lightGray: "#F5F5F5",
  borderV2: "#E0E0E0",
  rowAlt: "#F9F9F9",
  tableHeaderBg: "#1A1A1A",
  separatorBg: "#E8E8E8",
  hospitalBg: "#FAFAFA",
  success: "#166534",
  successBg: "#e8f5e9",
  amber: "#b45309",
  amberBg: "#fef3c7",
};

/** Decodifica o logo salvo como data URI (`data:image/png;base64,...`) em `Project.logoUrl` pra
 *  uso com <Image> no react-pdf. Guardado direto no banco (não em disco) porque o filesystem da
 *  Vercel é read-only em runtime — ver src/app/api/projects/[id]/logo/route.ts. Retorna null pra
 *  qualquer valor ausente ou malformado. */
export function resolveLogoBuffer(logoUrl: string | null | undefined): Buffer | null {
  if (!logoUrl) return null;
  const match = /^data:[^;]+;base64,(.+)$/.exec(logoUrl);
  if (!match) return null;
  try {
    return Buffer.from(match[1], "base64");
  } catch {
    return null;
  }
}

/** Correção 1: NENHUM/AJUSTE não têm divisória; TROCA_LENTE/TROCA_CAMERA usam cinza neutro;
 *  RESET_POSICAO usa âmbar; RESET_COMPLETO usa vermelho/perigo — cores distintas entre os dois
 *  tiers de HEAVY_RESETS (ver reset-divider.tsx, referência visual em React/DOM). Compartilhado
 *  entre os documentos de PDF que renderizam sub-linhas de plano (Call Sheet, Hora a Hora). */
export function resetDividerColor(tipoReset: ShotTipoReset): string {
  if (tipoReset === "RESET_COMPLETO") return colors.danger;
  if (tipoReset === "RESET_POSICAO") return colors.amber;
  return colors.medGray;
}

export const kit = StyleSheet.create({
  page: {
    paddingTop: 26,
    paddingBottom: 34,
    paddingHorizontal: 26,
    fontSize: 8.5,
    fontFamily: "Helvetica",
    color: colors.text,
  },
  bold: { fontWeight: 700 },
  muted: { color: colors.muted },
  small: { fontSize: 7.5 },
  docTitleBlock: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1.5,
    borderBottomColor: colors.headerBg,
    paddingBottom: 6,
    marginBottom: 8,
  },
  docTitleProject: { fontSize: 13, fontWeight: 700 },
  docTitleSub: { fontSize: 8, color: colors.muted, marginTop: 1 },
  docTitleRight: { alignItems: "flex-end" },
  docTitleDay: { fontSize: 11, fontWeight: 700 },
  docTitleDate: { fontSize: 8, color: colors.muted, marginTop: 1 },

  sectionTitle: {
    fontSize: 8.5,
    fontWeight: 700,
    backgroundColor: colors.headerBg,
    color: "#ffffff",
    paddingVertical: 2.5,
    paddingHorizontal: 5,
    marginBottom: 4,
  },

  table: { width: "100%" },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: colors.border },
  trHeader: {
    backgroundColor: colors.headerBgLight,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    borderBottomWidth: 1,
    borderBottomColor: colors.headerBg,
  },
  td: { paddingVertical: 3, paddingHorizontal: 4, justifyContent: "center" },

  kvRow: { flexDirection: "row", marginBottom: 1.5 },
  kvLabel: { fontWeight: 700 },

  separatorRow: {
    flexDirection: "row",
    justifyContent: "center",
    backgroundColor: colors.headerBgLight,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    paddingVertical: 2.5,
  },
  separatorText: { fontSize: 7.5, fontWeight: 700, color: colors.muted },

  badge: {
    borderWidth: 0.75,
    borderColor: colors.danger,
    backgroundColor: colors.dangerBg,
    color: colors.danger,
    fontSize: 7,
    fontWeight: 700,
    paddingVertical: 1.5,
    paddingHorizontal: 4,
    marginRight: 3,
    marginBottom: 3,
  },

  // ---- Redesenho visual: página, cabeçalho padrão, rodapé, variantes de tabela ----
  pageV2: {
    paddingTop: 32,
    paddingBottom: 46,
    paddingHorizontal: 32,
    fontSize: 8.5,
    fontFamily: "Helvetica",
    color: colors.black,
  },

  trHeaderDark: {
    backgroundColor: colors.tableHeaderBg,
    borderTopWidth: 0.5,
    borderTopColor: colors.tableHeaderBg,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.tableHeaderBg,
  },
  trAlt: { backgroundColor: colors.rowAlt },
  tdHeaderDarkText: { color: "#ffffff", fontWeight: 700, fontSize: 8 },

  standardHeader: { marginBottom: 12 },
  standardHeaderProject: { fontSize: 14, fontWeight: 700, color: colors.black },
  standardHeaderCredits: { fontSize: 9, color: colors.medGray, marginTop: 2 },
  standardHeaderDocTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: colors.black,
    marginTop: 7,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.black,
  },

  callSheetHeader: { marginBottom: 12, alignItems: "center" },
  callSheetHeaderLogo: { maxWidth: 150, maxHeight: 55, marginBottom: 6, objectFit: "contain" },
  callSheetHeaderProducaoFallback: {
    fontSize: 11,
    fontWeight: 700,
    color: colors.black,
    marginBottom: 6,
    textAlign: "center",
  },
  callSheetHeaderDiaria: {
    fontSize: 10,
    fontWeight: 700,
    color: colors.black,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  callSheetHeaderDate: {
    fontSize: 9,
    fontWeight: 700,
    color: colors.medGray,
    textAlign: "center",
    textTransform: "uppercase",
    marginTop: 3,
  },
  callSheetHeaderProject: { fontSize: 28, fontWeight: 700, color: colors.black, textAlign: "center", marginTop: 10 },
  callSheetHeaderCredits: { fontSize: 12, color: colors.black, textAlign: "center", marginTop: 5 },
  callSheetHeaderRuleOuter: { width: "100%", marginTop: 10, borderBottomWidth: 1.5, borderBottomColor: colors.black },
  callSheetHeaderRuleInner: { width: "100%", marginTop: 2, borderBottomWidth: 0.75, borderBottomColor: colors.black },

  footer: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: colors.borderV2,
    paddingTop: 5,
  },
  footerText: { fontSize: 7, color: colors.medGray, flex: 1 },
  footerCenter: { textAlign: "center" },
  footerRight: { textAlign: "right" },

  summaryCardsRow: { flexDirection: "row", marginBottom: 10 },
  summaryCard: {
    flex: 1,
    borderWidth: 0.75,
    borderColor: colors.borderV2,
    padding: 6,
    marginRight: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  summaryCardIcon: { fontSize: 13, fontWeight: 700, marginRight: 5 },
  summaryCardValue: { fontSize: 12, fontWeight: 700 },
  summaryCardLabel: { fontSize: 7, color: colors.medGray },

  castLegendBox: {
    marginBottom: 8,
    padding: 5,
    backgroundColor: colors.lightGray,
    borderWidth: 0.5,
    borderColor: colors.borderV2,
  },
  castLegendRow: { fontSize: 7, marginBottom: 1.5 },
});

export function Table({ children }: { children: React.ReactNode }) {
  return <View style={kit.table}>{children}</View>;
}

export function Tr({
  children,
  header,
  dark,
  alt,
  bg,
  wrap = false,
}: {
  children: React.ReactNode;
  header?: boolean;
  /** Opt-in: cabeçalho no estilo do redesenho (fundo #1A1A1A, texto branco) em vez do padrão claro. */
  dark?: boolean;
  /** Opt-in: linha "ímpar" com fundo levemente cinza, para zebra-striping. */
  alt?: boolean;
  /** Opt-in: cor de fundo específica desta linha (tem prioridade sobre `alt`). */
  bg?: string;
  wrap?: boolean;
}) {
  const rowStyle = {
    ...(header
      ? dark
        ? { ...kit.tr, ...kit.trHeaderDark }
        : { ...kit.tr, ...kit.trHeader }
      : alt
        ? { ...kit.tr, ...kit.trAlt }
        : kit.tr),
    ...(bg ? { backgroundColor: bg } : {}),
  };

  const content =
    header && dark
      ? React.Children.map(children, (child) =>
          React.isValidElement(child) ? React.cloneElement(child as React.ReactElement<{ headerDark?: boolean }>, { headerDark: true }) : child
        )
      : children;

  return (
    <View style={rowStyle} wrap={wrap}>
      {content}
    </View>
  );
}

export function Td({
  children,
  width,
  align,
  bold,
  headerDark,
}: {
  children?: React.ReactNode;
  width?: string | number;
  align?: "left" | "center" | "right";
  bold?: boolean;
  /** Injetado automaticamente por <Tr header dark> — não usar diretamente. */
  headerDark?: boolean;
}) {
  return (
    <View style={{ ...kit.td, ...(width ? { width } : { flex: 1 }) }}>
      <Text
        style={{
          ...(bold ? kit.bold : {}),
          ...(headerDark ? kit.tdHeaderDarkText : {}),
          ...(align ? { textAlign: align } : {}),
        }}
      >
        {children}
      </Text>
    </View>
  );
}

export function TimeRangeCell({
  width,
  start,
  end,
}: {
  width: string | number;
  start: string | null;
  end: string | null;
}) {
  return (
    <View style={{ ...kit.td, width, alignItems: "center" }}>
      {start && end ? (
        <>
          <Text style={{ fontSize: 7 }}>{start}</Text>
          <Text style={{ fontSize: 7 }}>{end}</Text>
        </>
      ) : (
        <Text>—</Text>
      )}
    </View>
  );
}

export function SeparatorRow({ label, bg, textColor }: { label: string; bg?: string; textColor?: string }) {
  return (
    <View style={{ ...kit.separatorRow, ...(bg ? { backgroundColor: bg } : {}) }} wrap={false}>
      <Text style={{ ...kit.separatorText, ...(textColor ? { color: textColor } : {}) }}>{label}</Text>
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={kit.sectionTitle}>{children}</Text>;
}

export function KeyValue({ label, value }: { label: string; value?: string | null }) {
  return (
    <Text style={kit.kvRow}>
      <Text style={kit.kvLabel}>{label}: </Text>
      {value && value.length > 0 ? value : "—"}
    </Text>
  );
}

export function DocHeader({
  projectTitulo,
  diretor,
  producao,
  numeroDia,
  totalShootDays,
  weekday,
  fullDate,
}: {
  projectTitulo: string;
  diretor?: string | null;
  producao?: string | null;
  numeroDia: number;
  totalShootDays: number;
  weekday: string;
  fullDate: string;
}) {
  return (
    <View style={kit.docTitleBlock}>
      <View>
        <Text style={kit.docTitleProject}>{projectTitulo}</Text>
        {(diretor || producao) && (
          <Text style={kit.docTitleSub}>
            {[diretor && `Direção: ${diretor}`, producao].filter(Boolean).join("  ·  ")}
          </Text>
        )}
      </View>
      <View style={kit.docTitleRight}>
        <Text style={kit.docTitleDay}>
          Diária de Filmagem #{numeroDia} de {totalShootDays}
        </Text>
        <Text style={kit.docTitleDate}>
          {weekday}, {fullDate}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Redesenho visual — cabeçalho/rodapé padrão e utilitários usados pelo Call
// Sheet e pelos Documentos do AD. Componentes novos, sem relação com os acima
// (que continuam servindo Budget/Breakdown/HH Schedule sem alteração).
// ---------------------------------------------------------------------------

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const PERIODO_ABREVIACAO: Record<string, string> = {
  DIA: "D",
  NOITE: "N",
  ENTARDECER: "E",
  AMANHECER: "A",
  CONTINUO: "C",
  DEPOIS: "P",
};

/** Abreviação de 1 letra pro período de uma cena (D/N/E/A/C/P) — "?" quando não detectado. */
export function periodoAbrev(periodo: string | null): string {
  if (!periodo) return "?";
  return PERIODO_ABREVIACAO[periodo] ?? "?";
}

/** Cabeçalho padrão de 3 linhas: projeto (14pt) / Direção · Produtora (9pt) / título do documento sublinhado (12pt). */
export function StandardHeader({
  projectTitulo,
  diretor,
  producao,
  documentTitle,
}: {
  projectTitulo: string;
  diretor?: string | null;
  producao?: string | null;
  documentTitle: string;
}) {
  return (
    <View style={kit.standardHeader}>
      <Text style={kit.standardHeaderProject}>{projectTitulo}</Text>
      {(diretor || producao) && (
        <Text style={kit.standardHeaderCredits}>
          {[diretor && `Direção: ${diretor}`, producao && `Produtora: ${producao}`].filter(Boolean).join(" · ")}
        </Text>
      )}
      <Text style={kit.standardHeaderDocTitle}>{documentTitle}</Text>
    </View>
  );
}

/** Cabeçalho do Call Sheet (modelo "Avesso de Mim"): logo da produtora (ou nome em bold como
 *  fallback), "Diária de Filmagem #X de Y" uppercase, data uppercase, projeto em 28pt de
 *  destaque máximo, direção, divisória dupla separando do corpo. */
export function CallSheetHeader({
  projectTitulo,
  diretor,
  producao,
  logoSrc,
  numeroDia,
  totalShootDays,
  weekday,
  fullDate,
}: {
  projectTitulo: string;
  diretor?: string | null;
  producao?: string | null;
  /** Buffer do arquivo de logo já lido do disco — ver resolveLogoBuffer() em call-sheet-document.tsx. */
  logoSrc?: Buffer | null;
  numeroDia: number;
  totalShootDays: number;
  weekday: string;
  fullDate: string;
}) {
  return (
    <View style={kit.callSheetHeader}>
      {logoSrc ? (
        // eslint-disable-next-line jsx-a11y/alt-text -- <Image> aqui é do @react-pdf/renderer (PDF), não next/image; não aceita alt.
        <Image src={logoSrc} style={kit.callSheetHeaderLogo} />
      ) : producao ? (
        <Text style={kit.callSheetHeaderProducaoFallback}>{producao}</Text>
      ) : null}
      <Text style={kit.callSheetHeaderDiaria}>
        DIÁRIA DE FILMAGEM #{numeroDia} DE {totalShootDays}
      </Text>
      <Text style={kit.callSheetHeaderDate}>
        {weekday}, {fullDate}
      </Text>
      <Text style={kit.callSheetHeaderProject}>{projectTitulo}</Text>
      {diretor && <Text style={kit.callSheetHeaderCredits}>Direção: {diretor}</Text>}
      <View style={kit.callSheetHeaderRuleOuter} />
      <View style={kit.callSheetHeaderRuleInner} />
    </View>
  );
}

/** Rodapé fixo em toda página: projeto (+ versão/draft) à esquerda, nome do documento ao centro, "Página X de Y" à direita. */
export function StandardFooter({
  projectTitulo,
  versionLabel,
  documentName,
}: {
  projectTitulo: string;
  versionLabel?: string | null;
  documentName: string;
}) {
  return (
    <View style={kit.footer} fixed>
      <Text style={kit.footerText}>
        {projectTitulo}
        {versionLabel ? ` · ${versionLabel}` : ""}
      </Text>
      <Text style={{ ...kit.footerText, ...kit.footerCenter }}>{documentName}</Text>
      <Text
        style={{ ...kit.footerText, ...kit.footerRight }}
        render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
      />
    </View>
  );
}

export function SummaryCardsRow({ children }: { children: React.ReactNode }) {
  return <View style={kit.summaryCardsRow}>{children}</View>;
}

/** Card de resumo com ícone textual (+, -, ~) — usado no resumo de Páginas Alteradas. */
export function SummaryCard({
  icon,
  iconColor,
  value,
  label,
}: {
  icon: string;
  iconColor: string;
  value: number;
  label: string;
}) {
  return (
    <View style={{ ...kit.summaryCard, marginRight: 6 }}>
      <Text style={{ ...kit.summaryCardIcon, color: iconColor }}>{icon}</Text>
      <View>
        <Text style={kit.summaryCardValue}>{value}</Text>
        <Text style={kit.summaryCardLabel}>{label}</Text>
      </View>
    </View>
  );
}

/** Legenda "1. Fulano  2. Beltrano..." (5 por linha) — só relevante quando o projeto usa NUMERACAO
 *  (ver lib/character-id.ts); nos demais casos o personagem já aparece nomeado por extenso. */
export function CastLegend({ entries }: { entries: { id: string; personagem: string }[] }) {
  const rows: { id: string; personagem: string }[][] = [];
  for (let i = 0; i < entries.length; i += 5) rows.push(entries.slice(i, i + 5));

  return (
    <View style={kit.castLegendBox}>
      {rows.map((row, i) => (
        <Text key={i} style={kit.castLegendRow}>
          {row.map((e) => `${e.id}. ${e.personagem}`).join("   ")}
        </Text>
      ))}
    </View>
  );
}
