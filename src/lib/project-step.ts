import type { ProjectStepEtapa } from "@prisma/client";

export const PROJECT_STEP_ETAPAS: ProjectStepEtapa[] = [
  "ROTEIRO",
  "ELENCO",
  "BREAKDOWN",
  "CRONOGRAMA",
  "ORDEM_DO_DIA",
  "ORCAMENTO",
];

export function isProjectStepEtapa(value: string): value is ProjectStepEtapa {
  return (PROJECT_STEP_ETAPAS as string[]).includes(value);
}
