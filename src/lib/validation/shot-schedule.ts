import { z } from "zod";

export const shotScheduleAssignSchema = z.object({
  shotId: z.string().min(1),
  bloco: z.enum(["MANHA", "TARDE"]).optional().nullable(),
});

export const shotScheduleUpdateSchema = z.object({
  bloco: z.enum(["MANHA", "TARDE"]).optional().nullable(),
});

export const shotScheduleReorderSchema = z.object({
  order: z.array(z.string().min(1)).min(1),
});
