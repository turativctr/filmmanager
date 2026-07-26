import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";

import { formatFullDate, weekdayNameFull } from "@/lib/calendar-grid";
import { getCharacterId } from "@/lib/character-id";
import { detectSceneConflicts } from "@/lib/conflicts";
import { formatPaginas } from "@/lib/paginas";
import { colors, DocHeader, kit, KeyValue } from "@/lib/pdf/kit";
import type { ShootDayReportData } from "@/lib/report-data";
import { timeToMinutes } from "@/lib/schedule";

const styles = StyleSheet.create({
  sceneSection: {
    marginBottom: 14,
    borderWidth: 0.75,
    borderColor: colors.border,
  },
  sceneHeader: {
    backgroundColor: colors.headerBg,
    color: "#ffffff",
    fontSize: 10,
    fontWeight: 700,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  sceneSubheader: { padding: 6, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  sceneSinopse: { fontSize: 8, marginBottom: 3 },
  metaRow: { flexDirection: "row" },
  metaItem: { marginRight: 14 },
  alertBox: {
    backgroundColor: colors.amberBg,
    borderBottomWidth: 0.75,
    borderBottomColor: colors.amber,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  alertText: { fontSize: 7.5, color: colors.amber, fontWeight: 700, marginBottom: 1.5 },
  notasOperacionaisBox: {
    backgroundColor: colors.headerBgLight,
    borderBottomWidth: 0.75,
    borderBottomColor: colors.headerBg,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  notasOperacionaisTitle: {
    fontSize: 7,
    fontWeight: 700,
    color: colors.headerBg,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 1.5,
  },
  notasOperacionaisText: { fontSize: 7.5, color: colors.text },
  columns: { flexDirection: "row", padding: 6 },
  column: { width: "33.33%", paddingRight: 6 },
  field: { marginBottom: 7 },
  fieldTitle: {
    fontSize: 6.5,
    fontWeight: 700,
    color: colors.muted,
    textTransform: "uppercase",
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  fieldText: { fontSize: 7.5, marginBottom: 1.5 },
  fieldEmpty: { fontSize: 7.5, color: colors.muted },
});

function groupByPrefix(items: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const item of items) {
    const idx = item.indexOf("_");
    const prefix = idx > 0 ? item.slice(0, idx) : "Geral";
    const value = idx > 0 ? item.slice(idx + 1) : item;
    map.set(prefix, [...(map.get(prefix) ?? []), value]);
  }
  return map;
}

function Field({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldTitle}>{title}</Text>
      {children}
    </View>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) return <Text style={styles.fieldEmpty}>—</Text>;
  return (
    <>
      {items.map((item, i) => (
        <Text key={i} style={styles.fieldText}>
          • {item}
        </Text>
      ))}
    </>
  );
}

/** Notas operacionais do AD para a cena NESTA diária (SceneShootDay.observacoes) — seção no topo
 *  da ficha, antes das seções técnicas (figurino, props etc.), só quando preenchida e diferente
 *  de Scene.notasAD (nota geral da cena, já mostrada em outro lugar — evita duplicar o mesmo texto). */
function NotasOperacionaisBox({ texto }: { texto: string }) {
  return (
    <View style={styles.notasOperacionaisBox}>
      <Text style={styles.notasOperacionaisTitle}>Notas operacionais da diária</Text>
      <Text style={styles.notasOperacionaisText}>{texto}</Text>
    </View>
  );
}

function GroupedList({ items }: { items: string[] }) {
  if (items.length === 0) return <Text style={styles.fieldEmpty}>—</Text>;
  const groups = groupByPrefix(items);
  return (
    <>
      {[...groups.entries()].map(([prefix, values]) => (
        <Text key={prefix} style={styles.fieldText}>
          <Text style={kit.bold}>{prefix}: </Text>
          {values.join(", ")}
        </Text>
      ))}
    </>
  );
}

export function BreakdownDocument({ data }: { data: ShootDayReportData }) {
  const { project, shootDay, totalShootDays, scenes } = data;

  const conflicts = detectSceneConflicts(
    scenes
      .filter((s) => s.schedule)
      .map((s) => ({
        sceneId: s.sceneId,
        numero: s.numero,
        characterIds: s.cast.map((c) => c.id),
        rodStartMin: timeToMinutes(s.schedule!.rodStart),
        rodEndMin: timeToMinutes(s.schedule!.rodEnd),
      })),
    (characterId) => {
      const character = scenes.flatMap((s) => s.cast).find((c) => c.id === characterId);
      return character ? getCharacterId(character, project) : characterId;
    }
  );

  return (
    <Document>
      <Page size="A4" style={kit.page}>
        <DocHeader
          projectTitulo={project.titulo}
          diretor={project.diretor}
          producao={project.producao}
          numeroDia={shootDay.numeroDia}
          totalShootDays={totalShootDays}
          weekday={weekdayNameFull(shootDay.data)}
          fullDate={formatFullDate(shootDay.data)}
        />

        {scenes.map((scene) => {
          const bd = scene.breakdownSheet;
          const sceneAlerts = conflicts.get(scene.sceneId) ?? [];
          const notasOperacionais =
            scene.observacoes && scene.observacoes !== scene.notasAD ? scene.observacoes : null;

          return (
            <View key={scene.sceneId} style={styles.sceneSection}>
              <Text style={styles.sceneHeader}>
                Cena {scene.numero} · {scene.tipo ?? "—"}/{scene.periodo ?? "—"} · {scene.setLocacaoDisplay}
              </Text>

              {sceneAlerts.length > 0 && (
                <View style={styles.alertBox}>
                  {sceneAlerts.map((message, i) => (
                    <Text key={i} style={styles.alertText}>
                      [!] CONFLITO: {message}
                    </Text>
                  ))}
                </View>
              )}

              {notasOperacionais && <NotasOperacionaisBox texto={notasOperacionais} />}

              <View style={styles.sceneSubheader}>
                <Text style={styles.sceneSinopse}>{scene.sinopse || "Sem sinopse."}</Text>
                <View style={styles.metaRow}>
                  <Text style={[styles.fieldText, styles.metaItem]}>
                    <Text style={kit.bold}>Dia narrativo: </Text>
                    {scene.diaNarrativo != null ? `Dia ${scene.diaNarrativo}` : "—"}
                  </Text>
                  <Text style={[styles.fieldText, styles.metaItem]}>
                    <Text style={kit.bold}>Páginas: </Text>
                    {formatPaginas(scene.paginas)}
                  </Text>
                  <Text style={[styles.fieldText, styles.metaItem]}>
                    <Text style={kit.bold}>Tempo estimado: </Text>
                    {scene.tempoEstimadoMin != null ? `${scene.tempoEstimadoMin} min` : "—"}
                  </Text>
                </View>
              </View>

              <View style={styles.columns}>
                <View style={styles.column}>
                  <Field title="Elenco">
                    {scene.cast.length === 0 ? (
                      <Text style={styles.fieldEmpty}>—</Text>
                    ) : (
                      scene.cast.map((c) => (
                        <Text key={c.id} style={styles.fieldText}>
                          {getCharacterId(c, project)} — {c.personagem}
                          {c.ator ? ` (${c.ator})` : ""}
                          {c.idadePersonagem != null ? `, ${c.idadePersonagem} anos` : ""}
                        </Text>
                      ))
                    )}
                  </Field>
                  <Field title="Figurino por personagem">
                    <GroupedList items={bd?.figurino ?? []} />
                  </Field>
                  <Field title="Maquiagem / Efeitos">
                    <BulletList items={bd?.make ?? []} />
                  </Field>
                </View>

                <View style={styles.column}>
                  <Field title="Arte / Dressing">
                    <Text style={styles.fieldText}>{bd?.arteDressing || "—"}</Text>
                  </Field>
                  <Field title="Objetos">
                    <GroupedList items={bd?.objetos ?? []} />
                  </Field>
                  <Field title="Comida de cena">
                    <BulletList items={bd?.comidaCena ?? []} />
                  </Field>
                </View>

                <View style={styles.column}>
                  <Field title="Som / Microfones">
                    <BulletList items={bd?.microfones ?? []} />
                  </Field>
                  <Field title="Trilha">
                    <BulletList items={bd?.trilha ?? []} />
                  </Field>
                  <Field title="Habilidades">
                    <GroupedList items={bd?.habilidades ?? []} />
                  </Field>
                  <Field title="Arte gráfica">
                    <BulletList items={bd?.arteGrafica ?? []} />
                  </Field>
                  <Field title="Pós-produção">
                    <BulletList items={bd?.posProducao ?? []} />
                  </Field>
                  <Field title="Notas por departamento">
                    {bd?.notasArte || bd?.notasFoto || bd?.notasSom || bd?.notasContinuidade || bd?.notasProducao ? (
                      <>
                        {bd?.notasArte && (
                          <Text style={styles.fieldText}>
                            <Text style={kit.bold}>Arte: </Text>
                            {bd.notasArte}
                          </Text>
                        )}
                        {bd?.notasFoto && (
                          <Text style={styles.fieldText}>
                            <Text style={kit.bold}>Foto: </Text>
                            {bd.notasFoto}
                          </Text>
                        )}
                        {bd?.notasSom && (
                          <Text style={styles.fieldText}>
                            <Text style={kit.bold}>Som: </Text>
                            {bd.notasSom}
                          </Text>
                        )}
                        {bd?.notasContinuidade && (
                          <Text style={styles.fieldText}>
                            <Text style={kit.bold}>Continuidade: </Text>
                            {bd.notasContinuidade}
                          </Text>
                        )}
                        {bd?.notasProducao && (
                          <Text style={styles.fieldText}>
                            <Text style={kit.bold}>Produção: </Text>
                            {bd.notasProducao}
                          </Text>
                        )}
                      </>
                    ) : (
                      <Text style={styles.fieldEmpty}>—</Text>
                    )}
                  </Field>
                </View>
              </View>
            </View>
          );
        })}
      </Page>
    </Document>
  );
}
