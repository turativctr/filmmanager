import { z } from "zod";

import { fdxSceneSchema } from "@/lib/validation/fdx-import";

export const onboardingProjectSchema = z.object({
  titulo: z.string().min(1),
  diretor: z.string().optional(),
  producao: z.string().optional(),
  dataInicio: z.string().optional(),
  dataFim: z.string().optional(),
  roteiristas: z.string().optional(),
  numeroDraft: z.string().optional(),
  dataDraft: z.string().optional(),
  contatoProducao: z.string().optional(),
});

export const onboardingCreateSchema = z.object({
  projeto: onboardingProjectSchema,
  scenes: z.array(fdxSceneSchema).default([]),
  arquivoNome: z.string().optional(),
});

export type OnboardingCreateInput = z.infer<typeof onboardingCreateSchema>;
