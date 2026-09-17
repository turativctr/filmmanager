/**
 * Timeline da diária: cenas e blocos de tempo livres (transporte, mudança de locação...) numa lista
 * só, na ordem que a AD montou. Puro, sem prisma — usado no stripboard, no recálculo do almoço, na
 * OD, no Modo Set, no Hora a Hora e nos PDFs.
 *
 * Bloco de tempo entra no horário do dia como um item sem prep (Rod = duração). Não é cena: não conta
 * oitavo, cena, plano, DOOD nem progresso de páginas — quem soma essas coisas só olha as cenas.
 */
import { computeBlockSchedule, type ComputedSchedule, type ScheduleItem } from "@/lib/schedule";

export const ROTULO_BLOCO_MAX = 30;

/** Botões rápidos ao adicionar — rótulo e duração editáveis depois. */
export const BLOCO_PRESETS: { rotulo: string; duracaoMin: number }[] = [
  { rotulo: "Transporte", duracaoMin: 30 },
  { rotulo: "Mudança de locação", duracaoMin: 45 },
  { rotulo: "Espera de luz", duracaoMin: 20 },
  { rotulo: "Maquiagem", duracaoMin: 30 },
  { rotulo: "Refeição", duracaoMin: 30 },
];

export type BlocoDeTempo = {
  id: string;
  rotulo: string;
  duracaoMin: number;
  ordem: number;
  bloco: "MANHA" | "TARDE";
};

export type ItemTimeline<C> = { tipo: "cena"; ordem: number; cena: C } | { tipo: "bloco"; ordem: number; bloco: BlocoDeTempo };

/** Junta cenas e blocos pela `ordem` (sequência compartilhada — ver ShootDayBlock no schema). Empate
 *  não deveria acontecer; se acontecer, cena primeiro, pra ordem ser estável. */
export function intercalar<C extends { ordem: number }>(cenas: C[], blocos: BlocoDeTempo[]): ItemTimeline<C>[] {
  const itens: ItemTimeline<C>[] = [
    ...cenas.map((cena) => ({ tipo: "cena" as const, ordem: cena.ordem, cena })),
    ...blocos.map((bloco) => ({ tipo: "bloco" as const, ordem: bloco.ordem, bloco })),
  ];
  return itens.sort((a, b) => a.ordem - b.ordem || (a.tipo === b.tipo ? 0 : a.tipo === "cena" ? -1 : 1));
}

/** Bloco não tem prep: ocupa a duração inteira. */
export function scheduleDoBloco(bloco: { duracaoMin: number }): ScheduleItem {
  return { prepMin: 0, rodMin: bloco.duracaoMin };
}

/** Horários de uma lista mista (um bloco do dia: manhã OU tarde), em paralelo aos itens. */
export function scheduleDaTimeline<C>(
  inicio: string | null | undefined,
  itens: ItemTimeline<C>[],
  scheduleDaCena: (cena: C) => ScheduleItem
): (ComputedSchedule | null)[] {
  return computeBlockSchedule(
    inicio,
    itens.map((i) => (i.tipo === "cena" ? scheduleDaCena(i.cena) : scheduleDoBloco(i.bloco)))
  );
}

export function minutosEmBlocos(blocos: { duracaoMin: number }[]): number {
  return blocos.reduce((s, b) => s + b.duracaoMin, 0);
}

export type BlocoNaTimeline = BlocoDeTempo & { inicio: string | null; fim: string | null };

/** Separa o resultado de uma timeline já calculada: horário de cada cena (na ordem das cenas) e cada
 *  bloco com início/fim. */
export function separarTimeline<C>(
  itens: ItemTimeline<C>[],
  schedule: (ComputedSchedule | null)[]
): { cenas: { cena: C; schedule: ComputedSchedule | null }[]; blocos: BlocoNaTimeline[] } {
  const cenas: { cena: C; schedule: ComputedSchedule | null }[] = [];
  const blocos: BlocoNaTimeline[] = [];
  itens.forEach((item, i) => {
    const s = schedule[i];
    if (item.tipo === "cena") cenas.push({ cena: item.cena, schedule: s });
    else blocos.push({ ...item.bloco, inicio: s?.rodStart ?? null, fim: s?.rodEnd ?? null });
  });
  return { cenas, blocos };
}
