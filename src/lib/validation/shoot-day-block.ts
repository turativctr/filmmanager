import { z } from "zod";

import { ROTULO_BLOCO_MAX } from "@/lib/day-timeline";

export const shootDayBlockSchema = z.object({
  // Até 30, igual ao rótulo de parte de cena: vai em coluna de OD e de PDF.
  rotulo: z.string().trim().min(1).max(ROTULO_BLOCO_MAX),
  duracaoMin: z.number().int().min(1).max(24 * 60),
});

export const shootDayBlockPatchSchema = shootDayBlockSchema.partial();
