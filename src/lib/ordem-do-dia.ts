/**
 * Motor de geração automática da Ordem do Dia a partir do que já existe no banco:
 * cenas do dia (com schedule Prep/Rod do Stripboard) e BreakdownSheet de cada cena.
 *
 * Convenção usada nos arrays de texto do BreakdownSheet (figurino, make, habilidades,
 * trilha, microfones): "Personagem_descrição" — o prefixo antes do primeiro "_" é
 * comparado (case-insensitive) com Character.personagem para atribuir o item a alguém;
 * sem esse prefixo (ou sem match), o item fica "não atribuído" (ex.: props de cenário
 * como "Cozinha_panela" atribuem a um objeto de cena, não a um personagem — nesse caso
 * o prefixo não bate com nenhum personagem e o item vira só texto livre).
 * Objetos críticos usam o marcador de texto "[CRÍTICO] " no início do item (não há
 * campo booleano dedicado no schema). Make "efeito especial" é detectado por conter a
 * palavra "efeito" na descrição (mesma razão — sem campo dedicado).
 */
import type { ReportSceneRow, ShotScheduleRow } from "@/lib/report-data";
import { minutesToTime, timeToMinutes } from "@/lib/schedule";
import { CREW_CALL_DEPARTMENTS } from "@/lib/report-constants";
import {
  detectPendingGaps,
  detectResumptions,
  HEAVY_RESETS,
  type DayOrderShot,
  type PendingGapAlert,
  type ResumptionAlert,
} from "@/lib/shots-shared";
import type { ShootDayChecklistTipo, ShotStatus, ShotTipoReset } from "@prisma/client";

export type CharacterLike = { id: string; idCurto: string; numeroElenco: number | null; personagem: string };

// ---------------------------------------------------------------------------
// Passo 2 — horários automáticos de elenco
// ---------------------------------------------------------------------------

export type CastAutoSchedule = {
  characterId: string;
  chamada: string | null;
  camarim: string | null;
  set: string | null;
  saida: string | null;
};

function scenesByCharacter(scenes: ReportSceneRow[]): Map<string, ReportSceneRow[]> {
  const map = new Map<string, ReportSceneRow[]>();
  for (const scene of scenes) {
    if (!scene.schedule) continue;
    for (const c of scene.cast) {
      const list = map.get(c.id) ?? [];
      list.push(scene);
      map.set(c.id, list);
    }
  }
  return map;
}

/** Set - 60min se alguma cena do dia do personagem tem make, -30min se só figurino, senão -15min. */
function makePrepMinutes(charScenes: ReportSceneRow[]): number {
  if (charScenes.some((s) => (s.breakdownSheet?.make.length ?? 0) > 0)) return 60;
  if (charScenes.some((s) => (s.breakdownSheet?.figurino.length ?? 0) > 0)) return 30;
  return 15;
}

export function computeCastAutoSchedule(scenes: ReportSceneRow[]): Map<string, CastAutoSchedule> {
  const result = new Map<string, CastAutoSchedule>();
  for (const [characterId, charScenes] of scenesByCharacter(scenes)) {
    const set = charScenes[0].schedule!.rodStart;
    const saida = charScenes[charScenes.length - 1].schedule!.rodEnd;
    const camarim = minutesToTime(timeToMinutes(set) - makePrepMinutes(charScenes));
    const chamada = minutesToTime(timeToMinutes(camarim) - 15);
    result.set(characterId, { characterId, chamada, camarim, set, saida });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Passo 2 — chamada de equipe por departamento
// ---------------------------------------------------------------------------

const MINUS_60_DEPARTMENTS = new Set(["Catering", "Produção"]);
const NO_DEFAULT_DEPARTMENTS = new Set(["Equipe Extra", "Pós-Produção"]);

export function defaultChamadaEquipe(chamadaGeral: string | null): Record<string, string> {
  if (!chamadaGeral) return {};
  const minus60 = minutesToTime(timeToMinutes(chamadaGeral) - 60);
  const result: Record<string, string> = {};
  for (const dept of CREW_CALL_DEPARTMENTS) {
    if (NO_DEFAULT_DEPARTMENTS.has(dept)) continue;
    result[dept] = MINUS_60_DEPARTMENTS.has(dept) ? minus60 : chamadaGeral;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Parsing "Personagem_descrição" e agregação por personagem
// ---------------------------------------------------------------------------

export function parsePersonagemPrefixed(
  text: string,
  characters: CharacterLike[]
): { character: CharacterLike | null; descricao: string } {
  const idx = text.indexOf("_");
  if (idx === -1) {
    const direct = characters.find((c) => c.personagem.toLowerCase() === text.trim().toLowerCase());
    return direct ? { character: direct, descricao: text.trim() } : { character: null, descricao: text.trim() };
  }
  const prefix = text.slice(0, idx).trim();
  const rest = text.slice(idx + 1).trim();
  const character = characters.find((c) => c.personagem.toLowerCase() === prefix.toLowerCase()) ?? null;
  return character ? { character, descricao: rest } : { character: null, descricao: text.trim() };
}

export type CharacterAggregation = {
  idCurto: string;
  entries: { descricao: string; scenes: string[] }[];
};

function aggregateFieldByCharacter(
  scenes: ReportSceneRow[],
  characters: CharacterLike[],
  field: "figurino" | "habilidades"
): CharacterAggregation[] {
  const byCharacter = new Map<string, Map<string, string[]>>();
  for (const scene of scenes) {
    for (const raw of scene.breakdownSheet?.[field] ?? []) {
      const { character, descricao } = parsePersonagemPrefixed(raw, characters);
      if (!character) continue;
      const descMap = byCharacter.get(character.idCurto) ?? new Map<string, string[]>();
      const sceneList = descMap.get(descricao) ?? [];
      if (!sceneList.includes(scene.numero)) sceneList.push(scene.numero);
      descMap.set(descricao, sceneList);
      byCharacter.set(character.idCurto, descMap);
    }
  }
  return [...byCharacter.entries()].map(([idCurto, descMap]) => ({
    idCurto,
    entries: [...descMap.entries()].map(([descricao, scenesList]) => ({ descricao, scenes: scenesList })),
  }));
}

export function aggregateHabilidades(scenes: ReportSceneRow[], characters: CharacterLike[]): CharacterAggregation[] {
  return aggregateFieldByCharacter(scenes, characters, "habilidades");
}

export function aggregateFigurino(scenes: ReportSceneRow[], characters: CharacterLike[]): CharacterAggregation[] {
  return aggregateFieldByCharacter(scenes, characters, "figurino");
}

/** "PRO: R4 (cena 5), R5/uniforme (cenas 8, 10, 11)" — "(todas)" se cobre todas as cenas do personagem no dia. */
export function formatCharacterAggregation(agg: CharacterAggregation, totalScenesForCharacter: number): string {
  const parts = agg.entries.map((e) => {
    if (totalScenesForCharacter > 1 && e.scenes.length === totalScenesForCharacter) return `${e.descricao} (todas)`;
    return `${e.descricao} (cena${e.scenes.length > 1 ? "s" : ""} ${e.scenes.join(", ")})`;
  });
  return `${agg.idCurto}: ${parts.join(", ")}`;
}

export function totalScenesByCharacter(scenes: ReportSceneRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const [characterId, charScenes] of scenesByCharacter(scenes)) {
    counts.set(characterId, charScenes.length);
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Make e efeitos especiais
// ---------------------------------------------------------------------------

export type MakeEntry = {
  idCurto: string;
  numeroElenco: number | null;
  descricao: string;
  scenes: string[];
  especial: boolean;
};

export function aggregateMake(scenes: ReportSceneRow[], characters: CharacterLike[]): MakeEntry[] {
  const map = new Map<string, { idCurto: string; numeroElenco: number | null; scenes: string[]; especial: boolean }>();
  for (const scene of scenes) {
    for (const raw of scene.breakdownSheet?.make ?? []) {
      const { character, descricao } = parsePersonagemPrefixed(raw, characters);
      if (!character) continue;
      const especial = /efeito/i.test(descricao);
      const key = `${character.idCurto}|${descricao}`;
      const entry = map.get(key) ?? {
        idCurto: character.idCurto,
        numeroElenco: character.numeroElenco,
        scenes: [],
        especial,
      };
      if (!entry.scenes.includes(scene.numero)) entry.scenes.push(scene.numero);
      map.set(key, entry);
    }
  }
  return [...map.entries()].map(([key, v]) => ({
    idCurto: v.idCurto,
    numeroElenco: v.numeroElenco,
    descricao: key.slice(key.indexOf("|") + 1),
    scenes: v.scenes,
    especial: v.especial,
  }));
}

/** "(todas)" se as cenas cobrem todas as cenas do personagem no dia, senão "cena(s) X, Y". */
export function formatMakeSceneLabel(scenes: string[], totalScenesForCharacter: number): string {
  if (totalScenesForCharacter > 1 && scenes.length === totalScenesForCharacter) return "todas";
  return `cena${scenes.length > 1 ? "s" : ""} ${scenes.join(", ")}`;
}

// ---------------------------------------------------------------------------
// Objetos, crítico e comida de cena
// ---------------------------------------------------------------------------

export type SceneTextEntry = { texto: string; sceneNumero: string };

export function aggregateObjetos(scenes: ReportSceneRow[]): { criticos: SceneTextEntry[]; normais: SceneTextEntry[] } {
  const criticos: SceneTextEntry[] = [];
  const normais: SceneTextEntry[] = [];
  for (const scene of scenes) {
    for (const raw of scene.breakdownSheet?.objetos ?? []) {
      const isCritico = raw.startsWith("[CRÍTICO]");
      const texto = isCritico ? raw.replace(/^\[CRÍTICO\]\s*/, "") : raw;
      (isCritico ? criticos : normais).push({ texto, sceneNumero: scene.numero });
    }
  }
  return { criticos, normais };
}

export function aggregateComidaCena(scenes: ReportSceneRow[]): SceneTextEntry[] {
  const entries: SceneTextEntry[] = [];
  for (const scene of scenes) {
    for (const raw of scene.breakdownSheet?.comidaCena ?? []) {
      entries.push({ texto: raw, sceneNumero: scene.numero });
    }
  }
  return entries;
}

/** Notas operacionais do AD por cena NESTA diária (SceneShootDay.observacoes) — diferente de
 *  Scene.notasAD (geral) e do BreakdownSheet (técnico). Só lista cenas com observações não-vazias. */
export function aggregateObservacoesDoDia(scenes: ReportSceneRow[]): SceneTextEntry[] {
  const entries: SceneTextEntry[] = [];
  for (const scene of scenes) {
    if (scene.observacoes && scene.observacoes.trim() !== "") {
      entries.push({ texto: scene.observacoes, sceneNumero: scene.numero });
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Pós-produção e trilhas (não atribuídos a personagem — só listados por cena)
// ---------------------------------------------------------------------------

export function aggregatePosProducao(scenes: ReportSceneRow[]): SceneTextEntry[] {
  const entries: SceneTextEntry[] = [];
  for (const scene of scenes) {
    for (const raw of scene.breakdownSheet?.posProducao ?? []) {
      entries.push({ texto: raw, sceneNumero: scene.numero });
    }
  }
  return entries;
}

export function aggregateTrilha(scenes: ReportSceneRow[], characters: CharacterLike[]): SceneTextEntry[] {
  const entries: SceneTextEntry[] = [];
  for (const scene of scenes) {
    for (const raw of scene.breakdownSheet?.trilha ?? []) {
      const { character, descricao } = parsePersonagemPrefixed(raw, characters);
      entries.push({ texto: character ? `${descricao} (${character.idCurto})` : descricao, sceneNumero: scene.numero });
    }
  }
  return entries;
}

export function aggregateMicrofones(scenes: ReportSceneRow[], characters: CharacterLike[]): string[] {
  const idCurtos = new Set<string>();
  for (const scene of scenes) {
    for (const raw of scene.breakdownSheet?.microfones ?? []) {
      const { character } = parsePersonagemPrefixed(raw, characters);
      if (character) idCurtos.add(character.idCurto);
    }
  }
  return [...idCurtos];
}

// ---------------------------------------------------------------------------
// Notas consolidadas por departamento
// ---------------------------------------------------------------------------

export type DepartmentNoteGroup = { departamento: string; texto: string; scenes: string[] };

const NOTE_FIELDS = [
  { key: "notasArte", label: "Arte" },
  { key: "notasFoto", label: "Foto" },
  { key: "notasSom", label: "Som" },
  { key: "notasContinuidade", label: "Continuidade" },
  { key: "notasProducao", label: "Produção" },
] as const;

export function consolidateNotes(scenes: ReportSceneRow[]): DepartmentNoteGroup[] {
  const map = new Map<string, string[]>();
  for (const scene of scenes) {
    if (!scene.breakdownSheet) continue;
    for (const { key, label } of NOTE_FIELDS) {
      const value = scene.breakdownSheet[key];
      if (!value) continue;
      const mapKey = `${label} ${value}`;
      const list = map.get(mapKey) ?? [];
      list.push(scene.numero);
      map.set(mapKey, list);
    }
  }
  return [...map.entries()].map(([mapKey, scenesList]) => {
    const [departamento, texto] = mapKey.split(" ");
    return { departamento, texto, scenes: scenesList };
  });
}

export function formatSceneList(scenes: string[]): string {
  if (scenes.length <= 1) return `cena ${scenes[0] ?? ""}`;
  if (scenes.length === 2) return `cenas ${scenes[0]} e ${scenes[1]}`;
  return `cenas ${scenes.join(", ")}`;
}

/** Junta itens no padrão de lista em português: "a", "a e b", "a, b e c". */
export function formatPortugueseList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} e ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Alertas — troca de roupa rápida entre cenas consecutivas do mesmo personagem
// ---------------------------------------------------------------------------

export type QuickChangeAlert = {
  idCurto: string;
  numeroElenco: number | null;
  fromScene: string;
  toScene: string;
  fromFigurino: string;
  toFigurino: string;
  gapMin: number;
};

function figurinoFor(scene: ReportSceneRow, character: CharacterLike): string | null {
  for (const raw of scene.breakdownSheet?.figurino ?? []) {
    const { character: c, descricao } = parsePersonagemPrefixed(raw, [character]);
    if (c) return descricao;
  }
  return null;
}

/** < 15min entre o fim do Rod de uma cena e o início do Rod da próxima, com figurino diferente. */
export function detectQuickChanges(scenes: ReportSceneRow[], characters: CharacterLike[]): QuickChangeAlert[] {
  const alerts: QuickChangeAlert[] = [];
  for (const [characterId, charScenes] of scenesByCharacter(scenes)) {
    const character = characters.find((c) => c.id === characterId);
    if (!character) continue;
    for (let i = 0; i < charScenes.length - 1; i++) {
      const a = charScenes[i];
      const b = charScenes[i + 1];
      const rawGapMin = timeToMinutes(b.schedule!.rodStart) - timeToMinutes(a.schedule!.rodEnd);
      if (rawGapMin >= 15) continue;
      // Blocos manhã/tarde têm cursores independentes (ver lib/schedule.ts) — cenas de blocos
      // diferentes podem se sobrepor no papel. Um gap negativo só significa "sem folga alguma",
      // não faz sentido mostrar minutos negativos para quem for ler o alerta.
      const gapMin = Math.max(0, rawGapMin);

      const figA = figurinoFor(a, character);
      const figB = figurinoFor(b, character);
      if (!figA || !figB || figA === figB) continue;

      alerts.push({
        idCurto: character.idCurto,
        numeroElenco: character.numeroElenco,
        fromScene: a.numero,
        toScene: b.numero,
        fromFigurino: figA,
        toFigurino: figB,
        gapMin,
      });
    }
  }
  return alerts;
}

// ---------------------------------------------------------------------------
// Alertas — resets pesados entre planos consecutivos (continuidade) — PARTE 3
// ---------------------------------------------------------------------------

export type ContinuidadeAlert = {
  sceneNumero: string;
  fromShotNumero: string;
  toShotNumero: string;
  tipoReset: ShotTipoReset;
};

/** Planos de cada cena já vêm com tipoReset calculado (classifyReset, ver lib/shots.ts) comparando
 *  com o plano anterior na mesma cena. Aqui só filtramos os resets "pesados" (RESET_POSICAO/
 *  RESET_COMPLETO) pra virar alerta de continuidade no Passo 3. */
export function detectContinuidadeAlerts(scenes: ReportSceneRow[]): ContinuidadeAlert[] {
  const alerts: ContinuidadeAlert[] = [];
  for (const scene of scenes) {
    const shots = scene.shots;
    for (let i = 1; i < shots.length; i++) {
      const shot = shots[i];
      if (!HEAVY_RESETS.includes(shot.tipoReset)) continue;
      alerts.push({
        sceneNumero: scene.numero,
        fromShotNumero: shots[i - 1].numero,
        toShotNumero: shot.numero,
        tipoReset: shot.tipoReset,
      });
    }
  }
  return alerts;
}

// ---------------------------------------------------------------------------
// Alertas — retomadas de cena e pendências parciais na ordem por plano (ShotSchedule) — PARTE 4
// ---------------------------------------------------------------------------

/** A partir da ordem do dia por plano (ShotSchedule — só populada quando o AD reorganizou os
 *  planos cruzando cenas), detecta cenas retomadas em momentos não-contíguos do dia e planos que
 *  ficaram pendentes numa cena que já teve algum plano filmado. Lista vazia de ShotSchedule =
 *  AD não usou reordenação por plano ainda — não há o que detectar (sem fallback pra ordem por cena). */
export function computeShotScheduleAlerts(
  shotSchedule: ShotScheduleRow[],
  scenes: ReportSceneRow[]
): { resumptionAlerts: ResumptionAlert[]; pendingGapAlerts: PendingGapAlert[] } {
  if (shotSchedule.length === 0) return { resumptionAlerts: [], pendingGapAlerts: [] };

  const dayOrder: DayOrderShot[] = shotSchedule.map((entry) => ({
    id: entry.shotId,
    sceneNumero: entry.sceneNumero,
    shotNumero: entry.numero,
    sceneId: entry.sceneId,
  }));
  const resumptionAlerts = detectResumptions(dayOrder);

  // detectPendingGaps precisa da lista COMPLETA de planos de cada cena agendada hoje (não só os
  // planos que estão no ShotSchedule) pra saber o que ainda falta filmar.
  const scheduledSceneIds = new Set(shotSchedule.map((entry) => entry.sceneId));
  const shotsByScene = new Map<string, { id: string; ordem: number; numero: string; status: ShotStatus }[]>();
  const sceneNumeroById = new Map<string, string>();
  for (const scene of scenes) {
    if (!scheduledSceneIds.has(scene.sceneId)) continue;
    sceneNumeroById.set(scene.sceneId, scene.numero);
    shotsByScene.set(
      scene.sceneId,
      scene.shots.map((shot) => ({ id: shot.id, ordem: shot.ordem, numero: shot.numero, status: shot.status }))
    );
  }
  const pendingGapAlerts = detectPendingGaps(shotsByScene, sceneNumeroById);

  return { resumptionAlerts, pendingGapAlerts };
}

// ---------------------------------------------------------------------------
// Checklist pré-set — geração automática de itens a partir de tudo acima
// ---------------------------------------------------------------------------

export type GeneratedChecklistItem = { item: string; tipo: ShootDayChecklistTipo };

export function generateChecklistItems(input: {
  locacaoNome: string | null;
  transporteHorario: string | null;
  transporteEndereco: string | null;
  castPresente: { idCurto: string; personagem: string; ator: string | null }[];
  scenes: ReportSceneRow[];
  characters: CharacterLike[];
}): GeneratedChecklistItem[] {
  const { locacaoNome, transporteHorario, transporteEndereco, castPresente, scenes, characters } = input;
  const items: GeneratedChecklistItem[] = [];

  if (locacaoNome) {
    items.push({ item: `Confirmar disponibilidade da locação (${locacaoNome})`, tipo: "LOCACAO" });
  }
  if (transporteHorario && transporteEndereco) {
    items.push({
      item: `Confirmar transporte (${transporteHorario} · ${transporteEndereco})`,
      tipo: "TRANSPORTE",
    });
  }
  if (castPresente.length > 0) {
    const nomes = castPresente.map((c) => c.ator ?? c.personagem).join(", ");
    items.push({ item: `Confirmar ${castPresente.length} ator(es): ${nomes}`, tipo: "ELENCO" });
  }

  const { criticos } = aggregateObjetos(scenes);
  for (const entry of criticos) {
    items.push({ item: `Arte: ${entry.texto} (cena ${entry.sceneNumero})`, tipo: "ARTE" });
  }
  for (const entry of aggregateComidaCena(scenes)) {
    items.push({ item: `Arte: preparar ${entry.texto} (cena ${entry.sceneNumero})`, tipo: "ARTE" });
  }

  const microfones = aggregateMicrofones(scenes, characters);
  if (microfones.length > 0) {
    items.push({ item: `Som: microfones para ${microfones.join(", ")}`, tipo: "SOM" });
  }

  for (const change of detectQuickChanges(scenes, characters)) {
    items.push({
      item: `Figurino: preparar troca rápida ${change.idCurto} entre cenas ${change.fromScene}→${change.toScene}`,
      tipo: "FIGURINO",
    });
  }

  for (const make of aggregateMake(scenes, characters)) {
    if (!make.especial) continue;
    items.push({
      item: `Make: efeito especial ${make.descricao} (${make.idCurto}) para ${formatSceneList(make.scenes)}`,
      tipo: "MAKE",
    });
  }

  const trilhas = aggregateTrilha(scenes, characters);
  if (trilhas.length > 0) {
    items.push({
      item: `Playback: ${trilhas.map((t) => `${t.texto} (cena ${t.sceneNumero})`).join(", ")}`,
      tipo: "PLAYBACK",
    });
  }

  return items;
}
