// Motor de geração automática do Hora a Hora a partir do que já existe no Stripboard/Ordem do
// Dia: chamada geral, prep/rod de cada cena, almoço, desprodução e horários de elenco já
// resolvidos em report-data.ts (reais via CharacterCallTime, ou estimados). A chamada individual
// de cada ator é uma regra própria deste documento (30min antes do RODAR), independente da
// "chamada" já calculada para a Call Sheet — ver spec: Hora a Hora deve funcionar só com dados do
// Stripboard, antes mesmo de haver CharacterCallTime cadastrado.
import type { HoraAHoraEventTipo } from "@prisma/client";

import { getCharacterId, type CharacterIdInput, type ProjectIdSystemInput } from "@/lib/character-id";
import type { ComputedSchedule } from "@/lib/schedule";
import { minutesToTime, timeToMinutes } from "@/lib/schedule";

export type HoraAHoraSceneInput = {
  numero: string;
  schedule: ComputedSchedule | null;
};

export type HoraAHoraCastInput = CharacterIdInput & {
  ator: string | null;
  personagem: string;
  /** Horário "RODAR" já resolvido (real ou estimado) — ver ReportCastPresente.set em report-data.ts. */
  set: string | null;
  saida: string | null;
};

/** Nome do ator (ou personagem, se sem ator) seguido do ID configurado do projeto entre
 *  parênteses — mantém o Hora a Hora legível no set sem abrir mão do sistema de ID (ver Bloco 2). */
function castLabel(c: HoraAHoraCastInput, project: ProjectIdSystemInput): string {
  return `${c.ator ?? c.personagem} (${getCharacterId(c, project)})`;
}

export type GeneratedHoraAHoraEvent = {
  horaInicio: string;
  horaFim: string | null;
  descricao: string;
  tipo: HoraAHoraEventTipo;
};

export const HORA_A_HORA_TIPO_LABELS: Record<HoraAHoraEventTipo, string> = {
  CHAMADA_EQUIPE: "Chamada de equipe",
  CHAMADA_ELENCO: "Chamada de elenco",
  SETUP: "Setup",
  ENSAIO: "Ensaio",
  RODANDO: "Rodando",
  ALMOCO: "Almoço",
  SAIDA: "Saída",
  DESPRODUCAO: "Desprodução",
  OUTRO: "Outro",
};

const CHAMADA_ELENCO_ANTECEDENCIA_MIN = 30;

export function generateHoraAHoraEvents(input: {
  chamadaGeral: string | null;
  almocoInicio: string | null;
  almocoFim: string | null;
  desprodInicio: string | null;
  scenes: HoraAHoraSceneInput[];
  castPresente: HoraAHoraCastInput[];
  project: ProjectIdSystemInput;
}): GeneratedHoraAHoraEvent[] {
  const { chamadaGeral, almocoInicio, almocoFim, desprodInicio, scenes, castPresente, project } = input;
  const events: GeneratedHoraAHoraEvent[] = [];

  if (chamadaGeral) {
    events.push({ horaInicio: chamadaGeral, horaFim: null, descricao: "Chamada geral da equipe", tipo: "CHAMADA_EQUIPE" });
  }

  for (const c of castPresente) {
    if (!c.set) continue;
    const chamadaAtor = minutesToTime(timeToMinutes(c.set) - CHAMADA_ELENCO_ANTECEDENCIA_MIN);
    events.push({
      horaInicio: chamadaAtor,
      horaFim: c.set,
      descricao: `Chamada — ${castLabel(c, project)}`,
      tipo: "CHAMADA_ELENCO",
    });
  }

  for (const scene of scenes) {
    if (!scene.schedule) continue;
    events.push({
      horaInicio: scene.schedule.prepStart,
      horaFim: scene.schedule.prepEnd,
      descricao: `SETAR CENA ${scene.numero}`,
      tipo: "SETUP",
    });
    events.push({
      horaInicio: scene.schedule.rodStart,
      horaFim: scene.schedule.rodEnd,
      descricao: `RODANDO CENA ${scene.numero}`,
      tipo: "RODANDO",
    });
  }

  if (almocoInicio) {
    events.push({ horaInicio: almocoInicio, horaFim: almocoFim, descricao: "Almoço", tipo: "ALMOCO" });
  }

  for (const c of castPresente) {
    if (!c.saida) continue;
    events.push({
      horaInicio: c.saida,
      horaFim: null,
      descricao: `SAÍDA — ${castLabel(c, project)}`,
      tipo: "SAIDA",
    });
  }

  if (desprodInicio) {
    events.push({ horaInicio: desprodInicio, horaFim: null, descricao: "Desprodução", tipo: "DESPRODUCAO" });
  }

  return events.sort((a, b) => timeToMinutes(a.horaInicio) - timeToMinutes(b.horaInicio));
}
