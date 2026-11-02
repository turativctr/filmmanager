import { minutesToTime, timeToMinutes } from "@/lib/schedule";

export const CREW_CALL_DEPARTMENTS = [
  "Catering",
  "Produção",
  "Diretor",
  "Assistentes de Direção",
  "Continuidade",
  "Arte",
  "Figurino",
  "Maquiagem",
  "Câmera",
  "Elétrica",
  "Maquinária",
  "Som",
  "Making Of/Still",
  "Equipe Extra",
  "Pós-Produção",
] as const;

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

export const FIXED_SAFETY_RULES = [
  "Qualquer tipo de discriminação, assédio ou retaliação não será tolerado.",
  "Violência e abuso contra mulher, racismo e LGBTfobia são crimes.",
  "É proibido gravar, fotografar e/ou postar qualquer momento de set ou bastidores que revele material do filme ou elenco.",
  "Fumar somente nas áreas indicadas pela produção.",
];
