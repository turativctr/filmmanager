import { z } from "zod";

export const stripboardChangeSchema = z.object({
  sceneId: z.string(),
  shootDayId: z.string().nullable(),
  bloco: z.enum(["MANHA", "TARDE"]).nullable(),
  ordem: z.number().int(),
  prepMin: z.number().int().nullable().optional(),
  rodMin: z.number().int().nullable().optional(),
});

export const stripboardReorderSchema = z.object({
  changes: z.array(stripboardChangeSchema),
});

export type StripboardChange = z.infer<typeof stripboardChangeSchema>;
